import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { Icons } from './icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const pieData = [
  { name: 'Em aberto', value: 318 },
  { name: 'Ganhos', value: 96 },
  { name: 'Perdidos', value: 164 },
];
const COLORS = ['#3B82F6', '#10B981', '#EF4444'];

const barData = [
  { name: 'Novo lead', Quantidade: 50 },
  { name: 'Qualificação', Quantidade: 80 },
  { name: 'Pré-agendamento', Quantidade: 120 },
  { name: 'Apresentação da Oferta', Quantidade: 150 },
  { name: 'Reunião Agendada', Quantidade: 200 },
  { name: 'Perdido', Quantidade: 400 },
  { name: 'Retorno confirmado', Quantidade: 180 },
  { name: 'Proposta enviada', Quantidade: 90 },
  { name: 'Follow up', Quantidade: 60 },
  { name: 'Em assinatura', Quantidade: 40 },
  { name: 'Negócio perdido', Quantidade: 110 },
  { name: 'Aguardando Atendimento', Quantidade: 70 },
];

const StatCard = ({ title, value, subValue }: { title: string, value: string, subValue: string }) => (
    <Card className="flex-1">
        <h3 className="text-sm font-medium text-brand-text-secondary">{title}</h3>
        <p className="text-3xl font-bold text-brand-text-primary mt-2">{value}</p>
        <p className="text-xs text-brand-text-secondary mt-1">{subValue}</p>
    </Card>
);

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-brand-text-primary">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <select className="bg-brand-surface border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-yellow">
            <option>Selecione um Funil</option>
            <option>Funil de Vendas</option>
            <option>Funil de Marketing</option>
          </select>
          <Button variant="secondary">
            <Icons.Refresh className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
          <StatCard title="Total de Negociações" value="428" subValue="Em aberto: 318 | Ganhos: 96 | Perdidos: 164" />
          <StatCard title="Valor Total" value="R$ 310.804,60" subValue="Valor médio por negociação R$ 726,18" />
          <StatCard title="Taxa de Conversão" value="1.2%" subValue="5 ganhos de 428 negociações" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-brand-text-primary mb-4">Status das Negociações</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" labelLine={false}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-semibold text-brand-text-primary mb-4">Negociações por Estágio</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                <XAxis type="number" stroke="#4B5563" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#4B5563" fontSize={12} width={150} tick={{ fill: '#111827' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }} cursor={{fill: '#F3F4F6'}} />
                <Bar dataKey="Quantidade" fill="#3B82F6" barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;