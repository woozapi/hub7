export enum View {
  Dashboard = 'Dashboard',
  AIAgent = 'Agente de IA',
  CRM = 'CRM',
  Appointments = 'Agendamentos',
  Prospecting = 'Prospectar',
  Contacts = 'Contatos',
  Connection = 'Conexão',
  Settings = 'Configurações',
  SalesAutomation = 'Automação',
  SuperAdmin = 'Super Admin'
}

export interface User {
  id: string;
  name: string;
  type: 'ADMIN' | 'USER';
  status: boolean;
}