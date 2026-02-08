import React, { useState, useEffect } from 'react';
import { 
  getAppointments, 
  updateAppointmentStatus, 
  subscribeToChanges, 
  getAnnouncement, 
  saveAnnouncement, 
  getAnnouncementHistory 
} from '../services/storage';
import { Appointment, Announcement, AnnouncementHistoryItem } from '../types';
import { Button } from './ui/Button';
import { CalendarCheck, Trash2, Check, RefreshCw, X, Megaphone, AlertTriangle, Save, History, Clock, Loader2 } from 'lucide-react';
import { SERVICES } from '../constants';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today'>('all');
  
  // Announcement State
  const [announcement, setAnnouncement] = useState<Announcement>({ message: '', isActive: false, type: 'info' });
  const [history, setHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [showNoticeSuccess, setShowNoticeSuccess] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);

  const loadData = async () => {
    // Keep loading state mostly for initial load, subsequent updates can be background
    if (appointments.length === 0) setLoading(true);
    
    const data = await getAppointments();
    // Sort by Date then Time
    data.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
    setAppointments(data);
    
    // Load announcement and history
    const activeAnnouncement = await getAnnouncement();
    setAnnouncement(activeAnnouncement);
    
    const historyData = await getAnnouncementHistory();
    setHistory(historyData);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return unsubscribe;
  }, []);

  const handleStatusChange = async (id: string, status: Appointment['status']) => {
    // Optimistic update
    const prevAppointments = [...appointments];
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    
    try {
      await updateAppointmentStatus(id, status);
    } catch (e) {
      // Revert on error
      setAppointments(prevAppointments);
      console.error(e);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotice(true);
    await saveAnnouncement(announcement);
    setSavingNotice(false);
    setShowNoticeSuccess(true);
    setTimeout(() => setShowNoticeSuccess(false), 3000);
  };

  const handleReactivate = (item: AnnouncementHistoryItem) => {
    setAnnouncement({
      message: item.message,
      type: item.type,
      isActive: true
    });
  };

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const filteredAppointments = appointments.filter(app => {
    if (filter === 'today') return app.date === today;
    return true;
  });

  const getServiceName = (id: string) => SERVICES.find(s => s.id === id)?.name || id;

  // Revenue Calculation: If 'all' is selected, show Current Month Revenue. If 'today', show Today's.
  const revenueLabel = filter === 'all' ? 'Este Mês' : 'Hoje';
  
  const totalRevenue = appointments
    .filter(a => {
      // Must be confirmed
      if (a.status !== 'confirmed') return false;
      
      const appDate = new Date(a.date + 'T00:00:00'); // Ensure timezone consistency for date parsing
      
      if (filter === 'today') {
        return a.date === today;
      } else {
        // Current month check
        return appDate.getMonth() === currentMonth && appDate.getFullYear() === currentYear;
      }
    })
    .reduce((acc, curr) => acc + (SERVICES.find(s => s.id === curr.serviceId)?.price || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] bg-dark-950 overflow-y-auto">
      <div className="min-h-screen">
        {/* Admin Header */}
        <header className="bg-dark-900 border-b border-dark-800 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-gold-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
              <p className="text-xs text-gray-500">CorteFácil Management v2.0 (Cloud)</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:block text-right">
                <p className="text-sm text-gray-400">Receita ({revenueLabel})</p>
                <p className="text-xl font-bold text-green-500">R$ {totalRevenue},00</p>
             </div>
             <Button variant="secondary" onClick={onLogout}>Sair</Button>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Management Tools */}
            <div className="lg:col-span-2 space-y-8">
              
               {/* Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 bg-dark-900 p-1 rounded-lg border border-dark-800">
                  <button 
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gold-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setFilter('today')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'today' ? 'bg-gold-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Hoje
                  </button>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                   Sincronizado
                </div>
              </div>

              {/* Table */}
              <div className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-dark-800 text-gray-400 border-b border-dark-700 text-sm uppercase tracking-wider">
                        <th className="p-4">Data</th>
                        <th className="p-4">Horário</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Serviço</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {loading && appointments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            Carregando dados...
                          </td>
                        </tr>
                      ) : filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-500">
                            Nenhum agendamento encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((app) => (
                          <tr key={app.id} className="hover:bg-dark-800/50 transition-colors">
                            <td className="p-4 text-white font-medium">
                              {new Date(app.date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 text-gold-500 font-bold font-mono text-lg">
                              {app.time}
                            </td>
                            <td className="p-4">
                              <div className="text-white font-medium">{app.customerName}</div>
                              <div className="text-sm text-gray-500">{app.customerPhone}</div>
                            </td>
                            <td className="p-4 text-gray-300">
                              {getServiceName(app.serviceId)}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                app.status === 'confirmed' ? 'bg-green-900/30 text-green-400 border border-green-900' :
                                app.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border border-red-900' :
                                'bg-yellow-900/30 text-yellow-400 border border-yellow-900'
                              }`}>
                                {app.status === 'confirmed' ? 'Confirmado' : 
                                 app.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                {app.status !== 'confirmed' && (
                                  <button 
                                    onClick={() => handleStatusChange(app.id, 'confirmed')}
                                    className="p-2 bg-green-900/20 text-green-500 hover:bg-green-900/40 rounded-lg transition-colors"
                                    title="Confirmar"
                                  >
                                    <Check className="w-5 h-5" />
                                  </button>
                                )}
                                {app.status !== 'cancelled' && (
                                  <button 
                                    onClick={() => handleStatusChange(app.id, 'cancelled')}
                                    className="p-2 bg-red-900/20 text-red-500 hover:bg-red-900/40 rounded-lg transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Announcement & Quick Stats */}
            <div className="space-y-8">
               
               {/* Announcement Manager */}
               <div className="bg-dark-900 rounded-xl border border-dark-800 p-6 shadow-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="bg-gold-600/20 p-2 rounded-lg">
                     <Megaphone className="w-5 h-5 text-gold-500" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Aviso no Site</h3>
                 </div>

                 <form onSubmit={handleSaveAnnouncement} className="space-y-4">
                   <div>
                     <label className="block text-sm text-gray-400 mb-2">Mensagem do Banner</label>
                     <textarea 
                       className="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 text-white focus:border-gold-500 outline-none text-sm resize-none h-24"
                       placeholder="Ex: Estaremos fechados no feriado..."
                       value={announcement.message}
                       onChange={e => setAnnouncement({...announcement, message: e.target.value})}
                     />
                   </div>

                   <div className="grid grid-cols-3 gap-2">
                      {(['info', 'alert', 'success'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAnnouncement({...announcement, type})}
                          className={`py-2 text-xs font-bold uppercase rounded border transition-all ${
                            announcement.type === type 
                            ? type === 'info' ? 'bg-blue-900/50 border-blue-500 text-blue-400'
                              : type === 'alert' ? 'bg-red-900/50 border-red-500 text-red-400'
                              : 'bg-green-900/50 border-green-500 text-green-400'
                            : 'bg-dark-800 border-dark-700 text-gray-500 hover:bg-dark-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                   </div>

                   <div className="flex items-center justify-between pt-2">
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded border-gray-600 bg-dark-800 text-gold-600 focus:ring-gold-600"
                         checked={announcement.isActive}
                         onChange={e => setAnnouncement({...announcement, isActive: e.target.checked})}
                       />
                       <span className="text-sm text-gray-300">Mostrar no site</span>
                     </label>
                   </div>

                   <Button type="submit" fullWidth className="flex items-center justify-center gap-2" disabled={savingNotice}>
                     {savingNotice ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                     Salvar Aviso
                   </Button>

                   {showNoticeSuccess && (
                     <p className="text-green-500 text-xs text-center animate-fade-in">Aviso atualizado com sucesso!</p>
                   )}
                 </form>
               </div>

               {/* Announcement History */}
               {history.length > 0 && (
                 <div className="bg-dark-900 rounded-xl border border-dark-800 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-5 h-5 text-gray-500" />
                      <h4 className="text-white font-bold text-sm uppercase">Histórico Recente (72h)</h4>
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                      {history.map(item => (
                        <div key={item.id} className="bg-dark-800 rounded-lg p-3 border border-dark-700 flex flex-col gap-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                item.type === 'info' ? 'border-blue-900 text-blue-400'
                                : item.type === 'alert' ? 'border-red-900 text-red-400'
                                : 'border-green-900 text-green-400'
                            }`}>
                              {item.type}
                            </span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.lastActiveAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 line-clamp-2">{item.message}</p>
                          <button 
                            onClick={() => handleReactivate(item)}
                            className="text-xs text-gold-500 hover:text-gold-400 text-left font-medium transition-colors"
                          >
                            Reativar Aviso
                          </button>
                        </div>
                      ))}
                    </div>
                 </div>
               )}

            </div>
          </div>

        </main>
      </div>
    </div>
  );
};