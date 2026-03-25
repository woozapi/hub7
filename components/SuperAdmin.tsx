import React, { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { Icons } from './icons';
import { useAuth } from '../src/lib/AuthContext';

interface Plan {
  id: string;
  name: string;
  price: number;
  leads_limit: number;
  scrapes_limit: number;
  features: string[];
}

interface Organization {
  id: string;
  name: string;
  plan_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  organization_id: string | null;
}

export const SuperAdmin: React.FC = () => {
  const { profile: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'plans' | 'users' | 'orgs'>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      fetchData();
    }
  }, [currentUser, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'plans') {
        const { data } = await supabase.from('plans').select('*').order('price', { ascending: true });
        setPlans(data || []);
      } else if (activeTab === 'users') {
        const { data } = await supabase.from('profiles').select('*');
        setUsers(data || []);
      } else if (activeTab === 'orgs') {
        const { data } = await supabase.from('organizations').select('*');
        setOrgs(data || []);
      }
    } catch (err) {
      console.error('Error fetching super admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      if (editingPlan.id) {
        await supabase.from('plans').update(editingPlan).eq('id', editingPlan.id);
      } else {
        await supabase.from('plans').insert([editingPlan]);
      }
      setEditingPlan(null);
      fetchData();
    } catch (err) {
      console.error('Error saving plan:', err);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      fetchData();
    } catch (err) {
      console.error('Error updating user role:', err);
    }
  };

  const handleUpdateOrgPlan = async (orgId: string, planId: string | null) => {
    try {
      await supabase.from('organizations').update({ plan_id: planId }).eq('id', orgId);
      fetchData();
    } catch (err) {
      console.error('Error updating org plan:', err);
    }
  };

  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="p-12 text-center">
        <Icons.AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-text-primary">Acesso Negado</h2>
        <p className="text-brand-text-secondary">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-brand-text-primary">Painel Super Admin</h2>
          <p className="text-brand-text-secondary">Gerenciamento global do sistema FLUOW AI.</p>
        </div>
        <div className="flex bg-white rounded-lg border border-brand-border p-1">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'plans' ? 'bg-brand-yellow-dark text-gray-900 shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
          >
            Planos
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-brand-yellow-dark text-gray-900 shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
          >
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('orgs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'orgs' ? 'bg-brand-yellow-dark text-gray-900 shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
          >
            Organizações
          </button>
        </div>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-brand-text-primary">Gerenciar Planos</h3>
            <button
              onClick={() => setEditingPlan({ name: '', price: 0, leads_limit: 100, scrapes_limit: 10, features: [] })}
              className="bg-brand-yellow-dark text-gray-900 font-bold px-4 py-2 rounded-lg flex items-center text-sm"
            >
              <Icons.Plus className="w-4 h-4 mr-2" /> Novo Plano
            </button>
          </div>

          {editingPlan && (
            <div className="bg-white p-6 rounded-xl border border-brand-border shadow-md">
              <form onSubmit={handleSavePlan} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Nome do Plano</label>
                    <input
                      type="text"
                      value={editingPlan.name}
                      onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      className="w-full px-3 py-2 border border-brand-border rounded-lg outline-none focus:ring-2 focus:ring-brand-yellow-dark"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Preço (R$)</label>
                    <input
                      type="number"
                      value={editingPlan.price}
                      onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-brand-border rounded-lg outline-none focus:ring-2 focus:ring-brand-yellow-dark"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Limite de Leads/Mês</label>
                    <input
                      type="number"
                      value={editingPlan.leads_limit}
                      onChange={e => setEditingPlan({ ...editingPlan, leads_limit: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-brand-border rounded-lg outline-none focus:ring-2 focus:ring-brand-yellow-dark"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Limite de Scrapes/Mês</label>
                    <input
                      type="number"
                      value={editingPlan.scrapes_limit}
                      onChange={e => setEditingPlan({ ...editingPlan, scrapes_limit: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-brand-border rounded-lg outline-none focus:ring-2 focus:ring-brand-yellow-dark"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="px-4 py-2 text-sm font-medium text-brand-text-secondary hover:text-brand-text-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-brand-yellow-dark text-gray-900 font-bold px-6 py-2 rounded-lg text-sm"
                  >
                    Salvar Plano
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white p-6 rounded-xl border border-brand-border shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-xl text-brand-text-primary">{plan.name}</h4>
                  <button onClick={() => setEditingPlan(plan)} className="text-brand-text-secondary hover:text-brand-yellow-dark">
                    <Icons.Edit className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-3xl font-bold text-brand-yellow-dark mb-6">
                  R$ {plan.price}<span className="text-sm text-brand-text-secondary font-normal">/mês</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-sm text-brand-text-secondary">
                    <Icons.Success className="w-4 h-4 text-green-500 mr-2" />
                    {plan.leads_limit} Leads por mês
                  </li>
                  <li className="flex items-center text-sm text-brand-text-secondary">
                    <Icons.Success className="w-4 h-4 text-green-500 mr-2" />
                    {plan.scrapes_limit} Scrapes por mês
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-brand-border">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Cargo</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Organização</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
                        {user.full_name?.[0] || 'U'}
                      </div>
                      <span className="font-medium text-brand-text-primary">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-text-secondary">
                    {user.organization_id || 'Sem Org'}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                      className="text-xs border border-brand-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-brand-yellow-dark"
                    >
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'orgs' && (
        <div className="bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-brand-border">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Organização</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Plano Atual</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Criada em</th>
                <th className="px-6 py-4 text-xs font-bold text-brand-text-secondary uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {orgs.map(org => (
                <tr key={org.id} className="hover:bg-gray-50 transition-all">
                  <td className="px-6 py-4 font-medium text-brand-text-primary">{org.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-brand-text-secondary">
                      {plans.find(p => p.id === org.plan_id)?.name || 'Sem Plano'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-text-secondary">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={org.plan_id || ''}
                      onChange={(e) => handleUpdateOrgPlan(org.id, e.target.value || null)}
                      className="text-xs border border-brand-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-brand-yellow-dark"
                    >
                      <option value="">Nenhum</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
