-- FLUOW AI SaaS - Supabase Schema

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    leads_limit INTEGER DEFAULT 100,
    scrapes_limit INTEGER DEFAULT 10,
    features JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    google_api_key TEXT,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Usage Tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    leads_count INTEGER DEFAULT 0,
    scrapes_count INTEGER DEFAULT 0,
    UNIQUE(organization_id, month)
);

-- 5. Create Profiles table (linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    role TEXT CHECK (role IN ('super_admin', 'admin', 'member')) DEFAULT 'member',
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating NUMERIC,
    reviews_count INTEGER,
    category TEXT,
    details TEXT,
    email TEXT,
    linkedin TEXT,
    cnpj TEXT,
    cnpj_location TEXT,
    is_location_match BOOLEAN,
    is_advertising BOOLEAN,
    ads_details TEXT,
    source TEXT CHECK (source IN ('google_maps', 'google_search')) DEFAULT 'google_maps',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Plans
-- Everyone can read plans (to see options)
CREATE POLICY "Anyone can view plans" 
ON public.plans FOR SELECT 
USING (true);

-- Only super admins can manage plans
CREATE POLICY "Super admins can manage plans" 
ON public.plans FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- 7. RLS Policies for Usage Tracking
-- Users can read their own organization's usage
CREATE POLICY "Users can view their own organization usage" 
ON public.usage_tracking FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Only super admins can manage usage tracking
CREATE POLICY "Super admins can manage usage tracking" 
ON public.usage_tracking FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- 8. RLS Policies for Organizations
-- Authenticated users can view organizations (needed for the .select() after insert)
CREATE POLICY "Authenticated users can view organizations" 
ON public.organizations FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Super admins can manage all organizations
CREATE POLICY "Super admins can manage organizations" 
ON public.organizations FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update their own organization
CREATE POLICY "Admins can update their own organization" 
ON public.organizations FOR UPDATE 
USING (
    id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- 9. RLS Policies for Profiles
-- Users can read their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Super admins can manage all profiles
CREATE POLICY "Super admins can manage profiles" 
ON public.profiles FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Users can insert their own profile (fallback if trigger fails)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 8. RLS Policies for Leads
-- Users can read leads from their organization
CREATE POLICY "Users can view leads from their organization" 
ON public.leads FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Users can insert leads into their organization
CREATE POLICY "Users can insert leads into their organization" 
ON public.leads FOR INSERT 
WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Users can update leads in their organization
CREATE POLICY "Users can update leads in their organization" 
ON public.leads FOR UPDATE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Users can delete leads in their organization
CREATE POLICY "Users can delete leads in their organization" 
ON public.leads FOR DELETE 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 9. Function to handle new user signup
-- This automatically creates a profile when a new user signs up in Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the first user in the profiles table
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    CASE WHEN is_first_user THEN 'super_admin' ELSE 'member' END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Create WhatsApp Instances table
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'close',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. RLS Policies for WhatsApp Instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization instances" 
ON public.whatsapp_instances FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their own organization instances" 
ON public.whatsapp_instances FOR ALL 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 13. Create Appointment Calendars table
CREATE TABLE IF NOT EXISTS public.appointment_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#EAB308',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Create Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES public.appointment_calendars(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    client_name TEXT,
    client_phone TEXT,
    client_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. RLS Policies for Appointments
ALTER TABLE public.appointment_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization calendars" 
ON public.appointment_calendars FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their own organization calendars" 
ON public.appointment_calendars FOR ALL 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Users can view their own organization appointments" 
ON public.appointments FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own organization appointments" 
ON public.appointments FOR ALL 
USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 16. RPC functions for usage tracking
CREATE OR REPLACE FUNCTION public.increment_usage_leads(org_id UUID, usage_month TEXT, inc_val INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_tracking (organization_id, month, leads_count)
  VALUES (org_id, usage_month, inc_val)
  ON CONFLICT (organization_id, month)
  DO UPDATE SET leads_count = public.usage_tracking.leads_count + inc_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_usage_scrapes(org_id UUID, usage_month TEXT, inc_val INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_tracking (organization_id, month, scrapes_count)
  VALUES (org_id, usage_month, inc_val)
  ON CONFLICT (organization_id, month)
  DO UPDATE SET scrapes_count = public.usage_tracking.scrapes_count + inc_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
