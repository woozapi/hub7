import React, { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import { Icons } from './icons';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  addDays,
  startOfDay,
  endOfDay,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Calendar {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface Appointment {
  id: string;
  calendar_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

const Appointments: React.FC = () => {
  const { organization, loading: authLoading } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newCalendar, setNewCalendar] = useState({ name: '', description: '', color: '#EAB308' });
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    description: '',
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm"),
    client_name: '',
    client_phone: '',
    client_email: '',
    status: 'pending' as const
  });

  const [error, setError] = useState<string | null>(null);

  const fetchCalendars = React.useCallback(async () => {
    if (!organization?.id) return;
    
    setError(null);
    try {
      const { data, error } = await supabase
        .from('appointment_calendars')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');

      if (error) throw error;
      
      const fetchedCalendars = data || [];
      setCalendars(fetchedCalendars);
      
      // Only set selected calendar if none is currently selected
      setSelectedCalendar(prev => {
        if (!prev && fetchedCalendars.length > 0) {
          return fetchedCalendars[0];
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Error fetching calendars:', err);
      if (err.code === 'PGRST116' || err.message?.includes('relation "public.appointment_calendars" does not exist')) {
        setError('Tabelas de agendamento não encontradas no banco de dados. Por favor, execute o script SQL de migração.');
      } else {
        setError('Erro ao carregar agendas: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const fetchAppointments = React.useCallback(async () => {
    if (!selectedCalendar?.id) return;

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('calendar_id', selectedCalendar.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [selectedCalendar?.id, currentMonth.getTime()]);

  useEffect(() => {
    if (!authLoading) {
      if (organization?.id) {
        fetchCalendars();
      } else {
        setLoading(false);
        setCalendars([]);
        setSelectedCalendar(null);
      }
    }
  }, [authLoading, organization?.id, fetchCalendars]);

  useEffect(() => {
    if (selectedCalendar?.id) {
      fetchAppointments();
    }
  }, [fetchAppointments]);

  const handleCreateCalendar = async () => {
    if (!newCalendar.name) {
      setError('O nome da agenda é obrigatório.');
      return;
    }
    
    if (!organization) {
      setError('Você precisa configurar sua organização nas Configurações antes de criar agendas.');
      return;
    }

    setError(null);
    try {
      const { data, error } = await supabase
        .from('appointment_calendars')
        .insert([{ ...newCalendar, organization_id: organization.id }])
        .select()
        .single();

      if (error) throw error;
      setCalendars([...calendars, data]);
      setSelectedCalendar(data);
      setShowCalendarModal(false);
      setNewCalendar({ name: '', description: '', color: '#EAB308' });
    } catch (err: any) {
      console.error('Error creating calendar:', err);
      setError('Erro ao criar agenda: ' + (err.message || 'Verifique se as tabelas existem no banco de dados.'));
    }
  };

  const handleCreateAppointment = async () => {
    if (!newAppointment.title || !selectedCalendar || !organization) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([{ 
          ...newAppointment, 
          calendar_id: selectedCalendar.id,
          organization_id: organization.id 
        }])
        .select()
        .single();

      if (error) throw error;
      setAppointments([...appointments, data]);
      setShowAppointmentModal(false);
      setNewAppointment({
        title: '',
        description: '',
        start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm"),
        client_name: '',
        client_phone: '',
        client_email: '',
        status: 'pending'
      });
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Agendamentos</h1>
          <p className="text-brand-text-secondary">Gerencie suas agendas e compromissos</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setShowCalendarModal(true)} variant="outline">
            <Icons.Plus className="w-4 h-4 mr-2" />
            Nova Agenda
          </Button>
          <Button onClick={() => setShowAppointmentModal(true)}>
            <Icons.Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        const dayAppointments = appointments.filter(app => isSameDay(parseISO(app.start_time), cloneDay));

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[120px] p-2 border border-brand-border transition-colors ${
              !isSameMonth(day, monthStart) ? "bg-gray-50 text-gray-400" : "bg-white"
            } ${isSameDay(day, new Date()) ? "bg-brand-yellow-light/20" : ""}`}
          >
            <span className="text-sm font-medium">{formattedDate}</span>
            <div className="mt-2 space-y-1">
              {dayAppointments.map(app => (
                <div 
                  key={app.id}
                  className="text-[10px] p-1 rounded bg-brand-yellow-light border border-brand-yellow-dark/20 truncate cursor-pointer hover:bg-brand-yellow-light/80"
                  title={`${format(parseISO(app.start_time), 'HH:mm')} - ${app.title}`}
                >
                  <span className="font-bold">{format(parseISO(app.start_time), 'HH:mm')}</span> {app.title}
                </div>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h2 className="text-lg font-bold text-brand-text-primary capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <Icons.ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <Icons.ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-gray-50 border-b border-brand-border">
          {daysOfWeek.map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold text-brand-text-secondary uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div>{rows}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-yellow-dark border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="max-w-7xl mx-auto">
        {renderHeader()}
        <div className="bg-white rounded-2xl border border-brand-border p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icons.AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-brand-text-primary mb-2">Organização não configurada</h2>
          <p className="text-brand-text-secondary mb-8">
            Você precisa configurar sua organização nas Configurações antes de gerenciar agendamentos.
          </p>
          <Button onClick={() => window.location.reload()}>
            <Icons.Refresh className="w-4 h-4 mr-2" />
            Recarregar Página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {renderHeader()}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center">
          <Icons.AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          <div className="text-sm font-medium">
            {error}
            {error.includes('Tabelas') && (
              <div className="mt-2 p-2 bg-white/50 rounded border border-red-200 font-mono text-[10px] overflow-x-auto">
                Execute o SQL em supabase_schema.sql no seu painel Supabase.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4">
            <h3 className="text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-4">Minhas Agendas</h3>
            <div className="space-y-2">
              {calendars.length === 0 ? (
                <p className="text-xs text-brand-text-secondary italic">Nenhuma agenda criada.</p>
              ) : (
                calendars.map(cal => (
                  <button
                    key={cal.id}
                    onClick={() => setSelectedCalendar(cal)}
                    className={`w-full flex items-center p-3 rounded-xl transition-all ${
                      selectedCalendar?.id === cal.id 
                        ? 'bg-brand-yellow-light border-brand-yellow-dark/30 shadow-sm' 
                        : 'hover:bg-gray-50 border-transparent'
                    } border`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mr-3" 
                      style={{ backgroundColor: cal.color }}
                    />
                    <span className={`text-sm font-medium ${selectedCalendar?.id === cal.id ? 'text-brand-text-primary' : 'text-brand-text-secondary'}`}>
                      {cal.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          {selectedCalendar && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-4">Próximos Compromissos</h3>
              <div className="space-y-4">
                {appointments
                  .filter(app => parseISO(app.start_time) >= new Date())
                  .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())
                  .slice(0, 5)
                  .map(app => (
                    <div key={app.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-10 text-center">
                        <div className="text-xs font-bold text-brand-yellow-dark">{format(parseISO(app.start_time), 'dd')}</div>
                        <div className="text-[10px] uppercase text-brand-text-secondary">{format(parseISO(app.start_time), 'MMM', { locale: ptBR })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-brand-text-primary truncate">{app.title}</p>
                        <p className="text-xs text-brand-text-secondary">{format(parseISO(app.start_time), 'HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                {appointments.length === 0 && (
                  <p className="text-xs text-brand-text-secondary italic">Sem compromissos próximos.</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Main Calendar */}
        <div className="lg:col-span-3">
          {selectedCalendar ? (
            renderCalendarGrid()
          ) : (
            <div className="bg-white rounded-2xl border border-brand-border p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-brand-yellow-light text-brand-yellow-dark rounded-full flex items-center justify-center mx-auto mb-6">
                <Icons.Appointments className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-brand-text-primary mb-2">Selecione uma Agenda</h2>
              <p className="text-brand-text-secondary mb-8">Escolha uma agenda na barra lateral ou crie uma nova para começar.</p>
              <Button onClick={() => setShowCalendarModal(true)}>
                <Icons.Plus className="w-4 h-4 mr-2" />
                Criar Primeira Agenda
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* New Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-brand-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-brand-text-primary">Nova Agenda</h3>
              <button onClick={() => setShowCalendarModal(false)} className="text-brand-text-secondary hover:text-brand-text-primary">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Nome da Agenda</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                  placeholder="Ex: Dr. João Silva ou Setor Comercial"
                  value={newCalendar.name}
                  onChange={(e) => setNewCalendar({ ...newCalendar, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Descrição</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                  placeholder="Opcional"
                  rows={3}
                  value={newCalendar.description}
                  onChange={(e) => setNewCalendar({ ...newCalendar, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Cor de Identificação</label>
                <div className="flex space-x-2">
                  {['#EAB308', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCalendar({ ...newCalendar, color })}
                      className={`w-8 h-8 rounded-full border-2 ${newCalendar.color === color ? 'border-brand-text-primary' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setShowCalendarModal(false)}>Cancelar</Button>
              <Button onClick={handleCreateCalendar}>Criar Agenda</Button>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-brand-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-brand-text-primary">Novo Agendamento</h3>
              <button onClick={() => setShowAppointmentModal(false)} className="text-brand-text-secondary hover:text-brand-text-primary">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Título do Compromisso</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                  placeholder="Ex: Consulta Odontológica"
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Início</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                    value={newAppointment.start_time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Fim</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                    value={newAppointment.end_time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="border-t border-brand-border pt-4">
                <h4 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-4">Informações do Cliente</h4>
                <div className="space-y-4">
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                    placeholder="Nome do Cliente"
                    value={newAppointment.client_name}
                    onChange={(e) => setNewAppointment({ ...newAppointment, client_name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                      placeholder="Telefone"
                      value={newAppointment.client_phone}
                      onChange={(e) => setNewAppointment({ ...newAppointment, client_phone: e.target.value })}
                    />
                    <input
                      type="email"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                      placeholder="E-mail"
                      value={newAppointment.client_email}
                      onChange={(e) => setNewAppointment({ ...newAppointment, client_email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Observações</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-yellow-dark/20 focus:border-brand-yellow-dark"
                  placeholder="Detalhes adicionais..."
                  rows={2}
                  value={newAppointment.description}
                  onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })}
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setShowAppointmentModal(false)}>Cancelar</Button>
              <Button onClick={handleCreateAppointment}>Agendar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
