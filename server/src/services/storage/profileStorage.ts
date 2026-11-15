import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../server/data/round3');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const LOCAL_PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

export interface UserProfileRecord {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  username?: string;
  bio?: string;
  public_id?: string;
  avatar_url?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

function readLocalProfiles(): Map<string, UserProfileRecord> {
  ensureDataDir();
  const map = new Map<string, UserProfileRecord>();
  if (fs.existsSync(LOCAL_PROFILES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOCAL_PROFILES_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach((p) => map.set(p.id, p));
      }
    } catch {}
  }
  return map;
}

function writeLocalProfiles(map: Map<string, UserProfileRecord>) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_PROFILES_FILE, JSON.stringify(Array.from(map.values()), null, 2), 'utf-8');
}

export const profileStorage = {
  /**
   * Retrieves profile by user ID or creates a baseline profile if not yet existing
   */
  async getProfile(userId: string, email?: string, fullName?: string): Promise<UserProfileRecord> {
    const localMap = readLocalProfiles();

    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (data && !error) {
          // Sync to local fallback
          localMap.set(userId, data);
          writeLocalProfiles(localMap);
          return data;
        }
      } catch (err) {
        // Fallback to local
      }
    }

    // 2. Check local fallback
    if (localMap.has(userId)) {
      return localMap.get(userId)!;
    }

    // 3. Create default profile if user exists
    const defaultUsername = (email ? email.split('@')[0] : `user_${userId.slice(0, 6)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    
    const newProfile: UserProfileRecord = {
      id: userId,
      email: email || '',
      full_name: fullName || defaultUsername,
      display_name: fullName || defaultUsername,
      username: defaultUsername,
      public_id: `NX-${userId.slice(0, 8).toUpperCase()}`,
      bio: 'Software engineer & architectural explorer on Er.NEXA.',
      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userId)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.upsertProfile(newProfile);
    return newProfile;
  },

  /**
   * Saves or updates a profile, checking username uniqueness
   */
  async upsertProfile(profile: UserProfileRecord): Promise<UserProfileRecord> {
    const localMap = readLocalProfiles();

    // Validate username uniqueness across other users
    if (profile.username) {
      const lower = profile.username.toLowerCase();
      for (const [uid, p] of localMap.entries()) {
        if (uid !== profile.id && p.username && p.username.toLowerCase() === lower) {
          throw new Error(`Username "@${profile.username}" is already taken by another user.`);
        }
      }
    }

    profile.updated_at = new Date().toISOString();

    // Save in Supabase
    if (supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name || profile.display_name,
            display_name: profile.display_name || profile.full_name,
            username: profile.username,
            bio: profile.bio,
            public_id: profile.public_id,
            avatar_url: profile.avatar_url,
            updated_at: profile.updated_at,
          });

        if (error && error.code !== 'PGRST205') {
          // If error is unique constraint violation
          if (error.code === '23505') {
            throw new Error(`Username "@${profile.username}" is already taken.`);
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('already taken')) throw err;
      }
    }

    // Save in local fallback
    localMap.set(profile.id, profile);
    writeLocalProfiles(localMap);
    return profile;
  },

  /**
   * Searches public profiles by query string
   */
  async searchProfiles(query: string, excludeUserId?: string, limit = 20): Promise<UserProfileRecord[]> {
    const q = query.trim().toLowerCase();
    const localMap = readLocalProfiles();
    const results: UserProfileRecord[] = [];

    // Search in local
    for (const p of localMap.values()) {
      if (excludeUserId && p.id === excludeUserId) continue;

      const matchUser = p.username && p.username.toLowerCase().includes(q);
      const matchName = (p.display_name || p.full_name || '').toLowerCase().includes(q);
      const matchPid = p.public_id && p.public_id.toLowerCase().includes(q);
      const matchEmail = p.email && p.email.toLowerCase().includes(q);

      if (matchUser || matchName || matchPid || matchEmail) {
        results.push(p);
      }
      if (results.length >= limit) break;
    }

    // Try Supabase if available
    if (supabaseAdmin && results.length < limit) {
      try {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, display_name, username, bio, public_id, avatar_url, created_at')
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,public_id.ilike.%${q}%`)
          .limit(limit);

        if (data) {
          data.forEach((p: any) => {
            if (excludeUserId && p.id === excludeUserId) return;
            if (!results.some((r) => r.id === p.id)) {
              results.push(p);
            }
          });
        }
      } catch {}
    }

    return results.slice(0, limit);
  },

  /**
   * Finds a public profile by username or public ID
   */
  async findByUsernameOrId(idOrUsername: string): Promise<UserProfileRecord | null> {
    const localMap = readLocalProfiles();
    const term = idOrUsername.toLowerCase();

    // Check by ID
    if (localMap.has(idOrUsername)) return localMap.get(idOrUsername)!;

    // Check by username or public ID
    for (const p of localMap.values()) {
      if (p.username && p.username.toLowerCase() === term) return p;
      if (p.public_id && p.public_id.toLowerCase() === term) return p;
    }

    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`id.eq.${idOrUsername},username.ilike.${idOrUsername},public_id.eq.${idOrUsername}`)
          .single();

        if (data) return data;
      } catch {}
    }

    return null;
  },
};
