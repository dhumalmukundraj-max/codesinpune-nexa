import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root directory or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  jwtSecret: process.env.JWT_SECRET || 'er-nexa-project-unlock-secret-key-389172',
};

// Check if credentials are provided and not default placeholders
export const isConfigured = {
  supabase: Boolean(
    config.supabaseUrl &&
    config.supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
    (config.supabaseAnonKey || config.supabaseServiceKey) &&
    config.supabaseAnonKey !== 'your-supabase-anon-key'
  ),
  gemini: Boolean(
    config.geminiApiKey &&
    config.geminiApiKey !== 'your-gemini-api-key' &&
    config.geminiApiKey.length > 5
  ),
};

// Initialize Supabase Admin Client if configured
export let supabaseAdmin: SupabaseClient | null = null;
if (isConfigured.supabase) {
  try {
    const key = config.supabaseServiceKey || config.supabaseAnonKey;
    supabaseAdmin = createClient(config.supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn('[Er.NEXA Server] Supabase client init warning:', err);
  }
}

// Initialize Google Gemini Client if configured
export let geminiClient: GoogleGenerativeAI | null = null;
if (isConfigured.gemini) {
  try {
    geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
  } catch (err) {
    console.warn('[Er.NEXA Server] Gemini client init warning:', err);
  }
}
