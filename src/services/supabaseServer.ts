// src/services/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Change to Service Role Key in true production for bypassing RLS, but for now matching the monolithic setup

export const supabaseAuth = createClient(supabaseUrl, supabaseKey);
