import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, Organization, isSupabaseConfigured } from './supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = React.useRef(false);

  const fetchProfileAndOrg = async (userId: string, email?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    
    console.log('AuthContext: Fetching profile and org for:', userId, email);
    try {
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const userEmail = (email || session?.user?.email || user?.email || '').toLowerCase().trim();
      const isSuperAdminEmail = userEmail === 'argolopaulo5@gmail.com' || userEmail === 'pauloargolo87@gmail.com';
      
      console.log('AuthContext: Profile fetch result:', { profileData, profileError, userEmail, isSuperAdminEmail });

      if ((profileError && profileError.code === 'PGRST116') || (!profileData && !profileError)) {
        // Profile doesn't exist, create it
        console.log('AuthContext: Profile not found, creating one. isSuperAdminEmail:', isSuperAdminEmail);
        
        try {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{ 
              id: userId, 
              role: isSuperAdminEmail ? 'super_admin' : 'member',
              full_name: session?.user?.user_metadata?.full_name || user?.user_metadata?.full_name || null,
              email: userEmail
            }])
            .select()
            .single();
          
          if (insertError) {
            console.warn('AuthContext: Error inserting profile (might be trigger conflict):', insertError);
            // If insert fails, it might be because of a trigger conflict
            // Try to fetch one more time
            const { data: retryProfile, error: retryError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            
            if (retryProfile) {
              profileData = retryProfile;
            } else {
              console.error('AuthContext: Retry fetch also failed:', retryError);
              // If it's the super admin email, we can create a virtual profile as a last resort
              if (isSuperAdminEmail) {
                profileData = {
                  id: userId,
                  role: 'super_admin',
                  full_name: session?.user?.user_metadata?.full_name || user?.user_metadata?.full_name || 'Super Admin',
                  organization_id: null,
                  avatar_url: null,
                  email: userEmail
                } as Profile;
              } else {
                throw insertError;
              }
            }
          } else {
            profileData = newProfile;
          }
        } catch (e) {
          console.error('AuthContext: Exception during profile creation:', e);
          if (isSuperAdminEmail) {
            profileData = { id: userId, role: 'super_admin', full_name: 'Super Admin', organization_id: null, avatar_url: null, email: userEmail } as Profile;
          } else {
            throw e;
          }
        }
      } else if (profileError) {
        console.error('AuthContext: Error fetching profile:', profileError);
        // Fallback for super admin
        if (isSuperAdminEmail) {
          profileData = { id: userId, role: 'super_admin', full_name: 'Super Admin', organization_id: null, avatar_url: null, email: userEmail } as Profile;
        } else {
          throw profileError;
        }
      } else if (profileData && isSuperAdminEmail && profileData.role !== 'super_admin') {
        // Ensure the specific user is always super_admin
        console.log('AuthContext: Forcing super_admin role for:', userEmail);
        try {
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'super_admin', email: userEmail })
            .eq('id', userId)
            .select()
            .single();
          
          if (updateError) {
            console.error('AuthContext: Error updating profile to super_admin:', updateError);
          } else {
            profileData = updatedProfile;
          }
        } catch (e) {
          console.error('AuthContext: Exception during role update:', e);
        }
      }

      console.log('AuthContext: Setting profile state:', profileData);
      setProfile(profileData);

      if (profileData?.organization_id) {
        console.log('AuthContext: Fetching organization:', profileData.organization_id);
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          .single();

        if (orgError) {
          console.error('AuthContext: Error fetching organization:', orgError);
          setOrganization(null);
        } else {
          console.log('AuthContext: Setting organization state:', orgData);
          setOrganization(orgData);
        }
      } else {
        setOrganization(null);
      }
    } catch (error) {
      console.error('AuthContext: Error in fetchProfileAndOrg:', error);
      setProfile(null);
      setOrganization(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Initial session check
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          await fetchProfileAndOrg(initialSession.user.id, initialSession.user.email);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Error in initAuth:', error);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('AuthContext: Auth state changed:', event, newSession?.user?.id);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          fetchProfileAndOrg(newSession.user.id, newSession.user.email);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setOrganization(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseConfigured]);

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndOrg(user.id, user.email);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, organization, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
