import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/lib/AuthContext';
import { supabase } from '../src/lib/supabase';
import { Icons } from './icons';

export const Settings: React.FC = () => {
  const { user, profile, organization, refreshProfile } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setApiKey(organization.google_api_key || '');
    }
  }, [organization]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      console.error('No profile found in handleSaveSettings');
      if (user) {
        console.log('User exists, attempting to refresh profile...');
        await refreshProfile();
      }
      setMessage({ 
        type: 'error', 
        text: 'Perfil não encontrado. Por favor, recarregue a página ou tente novamente.' 
      });
      return;
    }
    
    if (!orgName.trim()) {
      setMessage({ type: 'error', text: 'O nome da organização é obrigatório.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Use organization from context OR profile.organization_id as fallback
      let orgId = organization?.id || profile.organization_id;
      console.log('Saving settings. Current orgId:', orgId, 'Profile:', profile.id);

      if (!orgId) {
        console.log('No organization found, creating new one...');
        // Create new organization
        const { data: newOrg, error: createError } = await supabase
          .from('organizations')
          .insert([{ name: orgName.trim(), google_api_key: apiKey.trim() }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating organization:', createError);
          throw createError;
        }
        
        if (!newOrg) {
          throw new Error('Falha ao criar organização: nenhum dado retornado.');
        }

        orgId = newOrg.id;
        console.log('New organization created with ID:', orgId);

        // Update profile with orgId and set as Admin (if not super_admin)
        const newRole = profile.role === 'super_admin' ? 'super_admin' : 'admin';
        console.log('Updating profile with orgId and role:', newRole);
        
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ organization_id: orgId, role: newRole })
          .eq('id', profile.id);

        if (profileUpdateError) {
          console.error('Error updating profile:', profileUpdateError);
          throw profileUpdateError;
        }
        console.log('Profile updated successfully.');
      } else {
        console.log('Updating existing organization:', orgId);
        // Update existing organization
        const { error: updateError } = await supabase
          .from('organizations')
          .update({ name: orgName.trim(), google_api_key: apiKey.trim() })
          .eq('id', orgId);

        if (updateError) {
          console.error('Error updating organization:', updateError);
          throw updateError;
        }
        console.log('Organization updated successfully.');
      }

      console.log('Refreshing profile and organization data...');
      await refreshProfile();
      console.log('Data refreshed.');
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      console.error('Caught error in handleSaveSettings:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar configurações.' });
    } finally {
      setLoading(false);
    }
  };

  const userEmail = (user?.email || '').toLowerCase().trim();
  const isSuperAdmin = profile?.role === 'super_admin' || userEmail === 'argolopaulo5@gmail.com' || userEmail === 'pauloargolo87@gmail.com';
  const isAdmin = isSuperAdmin || profile?.role === 'admin' || !organization || !profile?.organization_id;

  if (!profile && !isSuperAdmin) {
    return (
      <div className="p-8 bg-white rounded-2xl shadow-sm border border-brand-border text-center">
        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icons.AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-brand-text-primary mb-2">Perfil não carregado</h2>
        <p className="text-brand-text-secondary mb-2">
          Não foi possível carregar suas informações de perfil. Isso pode ser um problema temporário de conexão.
        </p>
        <p className="text-xs text-brand-text-secondary mb-6 italic">
          Logado como: {user?.email || 'E-mail não identificado'}
        </p>
        <button
          onClick={() => refreshProfile()}
          className="bg-brand-yellow-dark text-gray-900 px-6 py-2 rounded-lg font-bold hover:bg-opacity-90 transition-colors flex items-center mx-auto"
        >
          <Icons.Refresh className="w-4 h-4 mr-2" />
          Tentar Carregar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-brand-text-primary">Configurações da Organização</h2>
          <p className="text-brand-text-secondary">Gerencie os dados da sua empresa e chaves de API.</p>
        </div>
        {isSuperAdmin && (
          <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
            Modo Super Admin
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-yellow-dark rounded-lg">
              <Icons.Settings className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h3 className="font-bold text-brand-text-primary">Geral</h3>
              <p className="text-xs text-brand-text-secondary">Informações básicas e chaves de acesso.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary mb-1">Nome da Organização</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-4 py-2 rounded-lg border border-brand-border focus:ring-2 focus:ring-brand-yellow-dark outline-none transition-all disabled:bg-gray-50"
                placeholder="Ex: Minha Empresa LTDA"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary mb-1">Google Gemini API Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-4 py-2 rounded-lg border border-brand-border focus:ring-2 focus:ring-brand-yellow-dark outline-none transition-all disabled:bg-gray-50"
                  placeholder="Sua chave API do Google AI Studio"
                />
                <div className="absolute right-3 top-2.5 text-brand-text-secondary">
                  <Icons.Eye className="w-4 h-4 cursor-pointer hover:text-brand-text-primary" />
                </div>
              </div>
              <p className="text-[10px] text-brand-text-secondary mt-1">
                Essa chave será usada para prospecção e enriquecimento de leads do seu time.
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {message.type === 'success' ? <Icons.Success className="w-4 h-4 mr-2" /> : <Icons.AlertTriangle className="w-4 h-4 mr-2" />}
              {message.text}
            </div>
          )}

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-yellow-dark text-gray-900 font-bold px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center"
              >
                {loading && <Icons.Refresh className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Icons.CRM className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-brand-text-primary">Seu Perfil</h3>
              <p className="text-xs text-brand-text-secondary">Dados da sua conta pessoal.</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-2xl font-bold">
              {profile?.full_name?.[0] || 'U'}
            </div>
            <div>
              <p className="font-bold text-lg text-brand-text-primary">{profile?.full_name || 'Usuário'}</p>
              <p className="text-sm text-brand-text-secondary">{profile?.email || user?.email}</p>
              <p className="text-[10px] text-brand-text-secondary uppercase tracking-wider font-semibold mt-1">
                Nível: {profile?.role || 'member'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
