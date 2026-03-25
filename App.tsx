import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AIAgent from './components/AIAgent';
import { Settings } from './components/Settings';
import { SuperAdmin } from './components/SuperAdmin';
import Connection from './components/Connection';
import Conversations from './components/Conversations';
import Appointments from './components/Appointments';
import PlaceholderPage from './components/PlaceholderPage';
import SalesAutomation from './components/SalesAutomation';
import Prospecting from './components/Prospecting';
import { Login } from './components/Login';
import { View } from './types';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import { isSupabaseConfigured } from './src/lib/supabase';
import { Icons } from './components/icons';

const AppContent: React.FC = () => {
  const { user, loading, organization, profile } = useAuth();
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-brand-border text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icons.AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text-primary mb-4">Configuração Necessária</h1>
          <p className="text-brand-text-secondary mb-8">
            As chaves do Supabase não foram encontradas. Por favor, configure as variáveis de ambiente:
          </p>
          <div className="space-y-3 text-left bg-gray-50 p-4 rounded-xl font-mono text-xs border border-brand-border mb-8">
            <p className="text-gray-600">VITE_SUPABASE_URL</p>
            <p className="text-gray-600">VITE_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-sm text-brand-text-secondary">
            Após adicionar as chaves no menu de configurações, a aplicação iniciará automaticamente.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-12 h-12 border-4 border-brand-yellow-dark border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // If user is logged in but has no organization, force settings view to create one
  // UNLESS they are a super_admin
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isSuperAdmin = profile?.role === 'super_admin' || userEmail === 'argolopaulo5@gmail.com' || userEmail === 'pauloargolo87@gmail.com';
  const viewToRender = (!organization && !isSuperAdmin) ? View.Settings : currentView;

  const renderView = () => {
    switch (viewToRender) {
      case View.Dashboard:
        return <Dashboard />;
      case View.AIAgent:
        return <AIAgent />;
      case View.CRM:
        return <Conversations />;
      case View.Appointments:
        return <Appointments />;
      case View.Prospecting:
        return <Prospecting />;
      case View.Contacts:
        return <PlaceholderPage title="Contatos" />;
      case View.Connection:
        return <Connection />;
      case View.Settings:
        return <Settings />;
      case View.SalesAutomation:
        return <SalesAutomation />;
      case View.SuperAdmin:
        return <SuperAdmin />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg text-brand-text-secondary font-sans">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          {!organization && !isSuperAdmin && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg mr-3">⚠️</div>
              <p className="text-sm font-medium">
                Você ainda não faz parte de uma organização. Por favor, configure sua empresa para começar.
              </p>
            </div>
          )}
          {renderView()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
