import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null as any;

export type Organization = {
  id: string;
  name: string;
  google_api_key?: string;
  created_at: string;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  role: 'super_admin' | 'admin' | 'member';
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
};

export type Lead = {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  category?: string;
  details?: string;
  email?: string;
  linkedin?: string;
  cnpj?: string;
  cnpj_location?: string;
  is_location_match?: boolean;
  is_advertising?: boolean;
  ads_details?: string;
  source: 'google_maps' | 'google_search';
  created_at: string;
};
