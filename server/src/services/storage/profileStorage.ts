import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabaseAdmin } from '../../config/index.js';

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

// In-memory cache ensures profiles are always available even if disk is read-only
const inMemoryProfiles = new Map<string, UserProfileRecord>();

/**
 * Safely resolves a writable data directory across local dev, Render, and serverless containers.
 */
function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/round3'),
    path.resolve(process.cwd(), 'server/data/round3'),
    path.join(os.tmpdir(), 'ernexa_round3'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      // Test write permission
      const testFile = path.join(candidate, '.write_test');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return '';
}

function readLocalProfiles(): Map<string, UserProfileRecord> {
  const map = new Map<string, UserProfileRecord>(inMemoryProfiles);
  try {
    const dir = getDataDir();
    if (dir) {
      const file = path.join(dir, 'profiles.json');
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((p) => {
            if (p && p.id) {
              map.set(p.id, p);
              inMemoryProfiles.set(p.id, p);
            }
          });
        }
      }
    }
  } catch (err) {
    // Non-fatal: in-memory map will be used
  }
  return map;
}

function writeLocalProfiles(map: Map<string, UserProfileRecord>) {
  for (const [k, v] of map.entries()) {
    inMemoryProfiles.set(k, v);
  }
  try {
    const dir = getDataDir();
    if (dir) {
      const file = path.join(dir, 'profiles.json');
      fs.writeFileSync(file, JSON.stringify(Array.from(map.values()), null, 2), 'utf-8');
    }
  } catch (err) {
    // Non-fatal: write to disk failed, in-memory state preserved
  }
}

export const profileStorage = {
  /**
   * Retrieves profile by user ID or creates a baseline profile if not yet existing.
   * Merges data from Supabase Auth user_metadata, public.profiles table, and local memory.
   */
  async getProfile(userId: string, email?: string, fullName?: string): Promise<UserProfileRecord> {
    const localMap = readLocalProfiles();

    let mergedProfile: UserProfileRecord = localMap.get(userId) || {
      id: userId,
      email: email || '',
      full_name: fullName || '',
      display_name: fullName || '',
      username: '',
      bio: '',
      public_id: `NX-${userId.slice(0, 8).toUpperCase()}`,
      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userId)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Fetch from Supabase Auth user_metadata (guaranteed to persist without table schema changes)
    if (supabaseAdmin) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser?.user) {
          const meta = authUser.user.user_metadata || {};
          if (authUser.user.email) mergedProfile.email = authUser.user.email;
          if (meta.display_name) mergedProfile.display_name = meta.display_name;
          if (meta.full_name && !mergedProfile.display_name) mergedProfile.display_name = meta.full_name;
          if (meta.username) mergedProfile.username = meta.username;
          if (meta.bio) mergedProfile.bio = meta.bio;
          if (meta.public_id) mergedProfile.public_id = meta.public_id;
          if (meta.avatar_url) mergedProfile.avatar_url = meta.avatar_url;
        }
      } catch {
        // Service role auth admin lookup failed or not permitted
      }
    }

    // 2. Fetch from public.profiles table in Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (data && !error) {
          mergedProfile = {
            ...mergedProfile,
            ...data,
            display_name: data.display_name || mergedProfile.display_name || data.full_name,
            username: data.username || mergedProfile.username,
            bio: data.bio !== undefined && data.bio !== null ? data.bio : mergedProfile.bio,
            public_id: data.public_id || mergedProfile.public_id,
            avatar_url: data.avatar_url || mergedProfile.avatar_url,
          };
        }
      } catch {
        // Query failed
      }
    }

    // 3. Ensure defaults for essential fields
    if (!mergedProfile.username) {
      const emailPrefix = (mergedProfile.email ? mergedProfile.email.split('@')[0] : `user_${userId.slice(0, 6)}`)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
      mergedProfile.username = emailPrefix;
    }

    if (!mergedProfile.display_name) {
      mergedProfile.display_name = mergedProfile.full_name || mergedProfile.username;
    }

    if (!mergedProfile.public_id) {
      mergedProfile.public_id = `NX-${userId.slice(0, 8).toUpperCase()}`;
    }

    if (!mergedProfile.avatar_url) {
      mergedProfile.avatar_url = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(userId)}`;
    }

    // Sync to local/memory cache
    localMap.set(userId, mergedProfile);
    writeLocalProfiles(localMap);

    return mergedProfile;
  },

  /**
   * Saves or updates a profile, checking username uniqueness and persisting to Supabase
   * with automatic fallback for missing table columns.
   */
  async upsertProfile(profile: UserProfileRecord): Promise<UserProfileRecord> {
    const localMap = readLocalProfiles();

    // 1. Validate username uniqueness across other local profiles
    if (profile.username) {
      const lower = profile.username.toLowerCase();
      for (const [uid, p] of localMap.entries()) {
        if (uid !== profile.id && p.username && p.username.toLowerCase() === lower) {
          throw new Error(`Username "@${profile.username}" is already taken by another user.`);
        }
      }
    }

    // 2. Ensure email is populated (profiles table has NOT NULL constraint on email)
    if (!profile.email && supabaseAdmin) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (authUser?.user?.email) {
          profile.email = authUser.user.email;
        }
      } catch {}
    }
    if (!profile.email) {
      profile.email = `${profile.username || 'user'}@ernexa.io`;
    }

    profile.updated_at = new Date().toISOString();

    // 3. Save metadata into Supabase Auth user_metadata (guaranteed to persist independently)
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          user_metadata: {
            full_name: profile.display_name || profile.full_name,
            display_name: profile.display_name || profile.full_name,
            username: profile.username,
            bio: profile.bio,
            public_id: profile.public_id,
            avatar_url: profile.avatar_url,
          },
        });
      } catch (authErr: any) {
        // Non-fatal if service role not permitted
      }
    }

    // 4. Save into public.profiles table in Supabase
    if (supabaseAdmin) {
      try {
        const extendedPayload = {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || profile.display_name,
          display_name: profile.display_name || profile.full_name,
          username: profile.username,
          bio: profile.bio,
          public_id: profile.public_id,
          avatar_url: profile.avatar_url,
          updated_at: profile.updated_at,
        };

        const { error } = await supabaseAdmin
          .from('profiles')
          .upsert(extendedPayload);

        if (error) {
          if (error.code === '23505') {
            throw new Error(`Username "@${profile.username}" is already taken.`);
          }

          // If extended columns are missing from table schema cache (PGRST204, 42703),
          // gracefully fall back to updating the known standard columns.
          const isColumnMissing =
            error.code === 'PGRST204' ||
            error.code === '42703' ||
            (error.message && (error.message.includes('column') || error.message.includes('schema cache')));

          if (isColumnMissing) {
            console.warn('[Er.NEXA profileStorage] Extended columns not present in public.profiles. Using standard columns fallback.');
            const basePayload = {
              id: profile.id,
              email: profile.email,
              full_name: profile.display_name || profile.full_name,
              avatar_url: profile.avatar_url,
              updated_at: profile.updated_at,
            };
            const { error: baseError } = await supabaseAdmin.from('profiles').upsert(basePayload);
            if (baseError && baseError.code === '23505') {
              throw new Error(`Profile record already exists for this ID.`);
            }
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('already taken')) throw err;
        console.warn('[Er.NEXA profileStorage] Supabase upsert non-fatal notice:', err.message);
      }
    }

    // 5. Always persist to local and in-memory cache
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

    // Search in local map
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
        // Try extended search first
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, display_name, username, bio, public_id, avatar_url, created_at')
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,public_id.ilike.%${q}%`)
          .limit(limit);

        if (data && !error) {
          data.forEach((p: any) => {
            if (excludeUserId && p.id === excludeUserId) return;
            if (!results.some((r) => r.id === p.id)) {
              results.push(p);
            }
          });
        } else if (error) {
          // Fallback to searching standard columns
          const { data: baseData } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, avatar_url, created_at')
            .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
            .limit(limit);

          if (baseData) {
            baseData.forEach((p: any) => {
              if (excludeUserId && p.id === excludeUserId) return;
              if (!results.some((r) => r.id === p.id)) {
                results.push({
                  ...p,
                  display_name: p.full_name,
                  username: (p.email ? p.email.split('@')[0] : p.id.slice(0, 8)).toLowerCase(),
                  public_id: `NX-${p.id.slice(0, 8).toUpperCase()}`,
                });
              }
            });
          }
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

    // Check by ID in local map
    if (localMap.has(idOrUsername)) return localMap.get(idOrUsername)!;

    // Check by username or public ID in local map
    for (const p of localMap.values()) {
      if (p.username && p.username.toLowerCase() === term) return p;
      if (p.public_id && p.public_id.toLowerCase() === term) return p;
    }

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`id.eq.${idOrUsername},username.ilike.${idOrUsername},public_id.eq.${idOrUsername}`)
          .maybeSingle();

        if (data && !error) return data;

        // Fallback: search by id only if column error occurred
        if (error) {
          const { data: byId } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', idOrUsername)
            .maybeSingle();

          if (byId) return byId;
        }
      } catch {}
    }

    return null;
  },
};
