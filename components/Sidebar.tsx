import React from 'react';
import { View } from '../types';
import { Icons, Logo } from './icons';
import { useAuth } from '../src/lib/AuthContext';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const navItems = [
  { view: View.Dashboard, icon: Icons.Dashboard },
  { view: View.AIAgent, icon: Icons.AIAgent },
  { view: View.CRM, icon: Icons.CRM },
  { view: View.Appointments, icon: Icons.Appointments },
  { view: View.Prospecting, icon: Icons.Prospecting },
  { view: View.Contacts, icon: Icons.Contacts },
  { view: View.Connection, icon: Icons.Connection },
  { view: View.SalesAutomation, icon: Icons.Workflow },
  { view: View.Settings, icon: Icons.Settings },
  { view: View.SuperAdmin, icon: Icons.Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const { profile, organization, signOut } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (item.view === View.SuperAdmin) return profile?.role === 'super_admin';
    return true;
  });

  return (
    <div className="w-64 bg-brand-surface flex flex-col p-4 text-brand-text-secondary border-r border-brand-border">
      <div className="mb-10">
        <Logo />
      </div>
      <nav className="flex-1">
        <ul>
          {filteredNavItems.map((item) => (
            <li key={item.view}>
              <button
                onClick={() => setView(item.view)}
                className={`w-full flex items-center px-4 py-2 my-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  currentView === item.view
                    ? 'bg-brand-yellow text-brand-text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.view}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <div 
          onClick={() => setView(View.Settings)}
          className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 cursor-pointer"
        >
            <div className="flex items-center">
                <div className="w-10 h-10 bg-brand-yellow rounded-full flex items-center justify-center text-brand-text-primary font-bold text-lg">
                    {profile?.full_name?.[0] || 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-semibold text-brand-text-primary truncate">{organization?.name || 'Sem Empresa'}</p>
                    <p className="text-xs text-brand-text-secondary truncate">{profile?.full_name || 'Meu Perfil'}</p>
                </div>
            </div>
            <Icons.ChevronDown className="w-4 h-4" />
        </div>
        <button 
          onClick={signOut}
          className="w-full flex items-center px-4 py-3 mt-2 rounded-md text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Icons.Logout className="w-5 h-5 mr-3" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;