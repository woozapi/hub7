import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import { Icons } from './icons';

interface WAStatus {
  status: 'connecting' | 'open' | 'close' | 'waiting';
  qr: string | null;
  me?: {
    id: string;
    name?: string;
  };
}

interface WAInstance {
  id: string;
  name: string;
  status: 'connecting' | 'open' | 'close' | 'waiting';
  qr: string | null;
  me?: {
    id: string;
    name?: string;
  };
}

const Connection: React.FC = () => {
  const { organization, profile } = useAuth();
  const [instances, setInstances] = useState<WAInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch registered instances from Supabase
  const fetchInstances = async () => {
    if (!organization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('organization_id', organization.id);
        
      if (error) throw error;
      
      const mappedInstances: WAInstance[] = data.map(inst => ({
        id: inst.id,
        name: inst.name,
        status: 'close',
        qr: null
      }));
      
      setInstances(mappedInstances);
      
      // Start each instance on the server
      for (const inst of mappedInstances) {
        fetch(`/api/whatsapp/instances/${inst.id}/start`, { method: 'POST' });
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
      setError('Erro ao carregar instâncias do banco de dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();

    const newSocket = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket with ID:', newSocket.id);
    });

    newSocket.on('whatsapp:status', (data: { instanceId: string; status: any; qr: string | null; me?: any }) => {
      console.log('WhatsApp status update:', data);
      setInstances(prev => prev.map(inst => 
        inst.id === data.instanceId 
          ? { ...inst, status: data.status, qr: data.qr, me: data.me }
          : inst
      ));
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error details:', err.message, err);
      setError(`Erro de conexão em tempo real: ${err.message}`);
    });

    return () => {
      newSocket.close();
    };
  }, [organization?.id]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName || !organization?.id) return;
    
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert([{
          organization_id: organization.id,
          name: newInstanceName
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      const newInst: WAInstance = {
        id: data.id,
        name: data.name,
        status: 'close',
        qr: null
      };
      
      setInstances(prev => [...prev, newInst]);
      setIsModalOpen(false);
      setNewInstanceName('');
      
      // Start the new instance on the server
      fetch(`/api/whatsapp/instances/${data.id}/start`, { method: 'POST' });
    } catch (err) {
      console.error('Error creating instance:', err);
      alert('Erro ao criar instância');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async (id: string) => {
    if (!confirm('Tem certeza que deseja desconectar este WhatsApp?')) return;
    try {
      await fetch(`/api/whatsapp/instances/${id}/logout`, { method: 'POST' });
    } catch (err) {
      alert('Erro ao desconectar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja EXCLUIR esta instância? Todos os dados de conexão serão perdidos.')) return;
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await fetch(`/api/whatsapp/instances/${id}`, { method: 'DELETE' });
      setInstances(prev => prev.filter(inst => inst.id !== id));
    } catch (err) {
      alert('Erro ao excluir instância');
    }
  };

  const handleReconnect = async (id: string) => {
    try {
      await fetch(`/api/whatsapp/instances/${id}/start`, { method: 'POST' });
    } catch (err) {
      alert('Erro ao reconectar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icons.Refresh className="w-8 h-8 animate-spin text-brand-yellow-dark" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-brand-yellow/20 flex items-center justify-center">
            <Icons.Connection className="w-6 h-6 text-brand-yellow-dark" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-brand-text-primary">Instâncias WhatsApp</h1>
            <p className="text-brand-text-secondary text-sm">Gerencie suas conexões e APIs do WhatsApp</p>
          </div>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)} className="bg-brand-yellow-dark hover:bg-brand-yellow text-brand-text-primary font-bold">
          <Icons.Plus className="w-5 h-5 mr-2" />
          Nova Instância
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center">
          <Icons.AlertTriangle className="w-5 h-5 mr-3" />
          {error}
        </div>
      )}

      {instances.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
            <Icons.Connection className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-brand-text-primary">Nenhuma instância encontrada</h3>
          <p className="text-brand-text-secondary max-w-md mx-auto">
            Você ainda não criou nenhuma instância do WhatsApp. Crie uma agora para começar a enviar mensagens.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="outline">
            Criar minha primeira instância
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {instances.map((inst) => (
            <Card key={inst.id} className="overflow-hidden border-2 border-transparent hover:border-brand-yellow/30 transition-all">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-brand-text-primary">{inst.name}</h3>
                    <p className="text-xs text-brand-text-secondary font-mono">ID: {inst.id}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    inst.status === 'open' ? 'bg-green-100 text-green-700' : 
                    inst.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {inst.status === 'open' ? 'Conectado' : 
                     inst.status === 'waiting' ? 'Aguardando QR' : 
                     inst.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                  {inst.status === 'open' ? (
                    <div className="flex-1 text-center md:text-left space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700">
                          <Icons.Success className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-green-900">WhatsApp Ativo</p>
                          <p className="text-xs text-green-800">{inst.me?.name || inst.me?.id || 'Sessão Ativa'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-red-600 border-red-100 hover:bg-red-50"
                          onClick={() => handleLogout(inst.id)}
                        >
                          <Icons.Logout className="w-4 h-4 mr-2" />
                          Sair
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleReconnect(inst.id)}
                        >
                          <Icons.Refresh className="w-4 h-4 mr-2" />
                          Reiniciar
                        </Button>
                      </div>
                    </div>
                  ) : inst.qr ? (
                    <div className="flex-1 flex flex-col items-center space-y-4">
                      <div className="bg-white p-3 rounded-xl shadow-inner border-2 border-brand-yellow">
                        <img src={inst.qr} alt="QR Code" className="w-40 h-40" />
                      </div>
                      <p className="text-[10px] text-center text-brand-text-secondary uppercase font-bold tracking-tighter">
                        Escaneie para conectar
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <Icons.Refresh className="w-8 h-8 animate-spin text-gray-300" />
                      <p className="text-xs text-brand-text-secondary">Iniciando serviço...</p>
                      <Button variant="ghost" size="sm" onClick={() => handleReconnect(inst.id)}>
                        Tentar novamente
                      </Button>
                    </div>
                  )}

                  <div className="w-full md:w-px h-px md:h-32 bg-gray-100" />

                  <div className="flex-1 space-y-3 w-full">
                    <h4 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest">Ações</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <Button variant="outline" size="sm" className="justify-start text-xs h-9">
                        <Icons.Conversations className="w-4 h-4 mr-2" />
                        Testar Envio
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start text-xs h-9">
                        <Icons.Settings className="w-4 h-4 mr-2" />
                        Configurar Webhook
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="justify-start text-xs h-9 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(inst.id)}
                      >
                        <Icons.Trash2 className="w-4 h-4 mr-2" />
                        Excluir Instância
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nova Instância */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-brand-text-primary">Nova Instância</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-text-secondary uppercase tracking-wider">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Ex: WhatsApp Vendas, Suporte..."
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:ring-2 focus:ring-brand-yellow focus:border-transparent outline-none transition-all"
                  required
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-brand-yellow-dark hover:bg-brand-yellow text-brand-text-primary font-bold"
                  loading={isCreating}
                >
                  Criar Instância
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Connection;
