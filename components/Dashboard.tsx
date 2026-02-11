
import React, { useState, useMemo } from 'react';
import { Project, ProjectStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  projects: Project[];
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const Dashboard: React.FC<DashboardProps> = ({ projects }) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Alertas urgentes
  const urgentActions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return projects.filter(p => {
      if (p.status === ProjectStatus.FINALIZADO) return false;
      
      // Regra 1: Em espera há mais de 3 dias após medição
      if (p.status === ProjectStatus.ESPERA && p.measurementDate) {
        const mDate = new Date(p.measurementDate);
        const diff = Math.ceil((today.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 3) return true;
      }
      
      // Regra 2: Prazo próximo ou vencido
      if (p.deadlineDate) {
        const dDate = new Date(p.deadlineDate);
        const diff = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 2) return true;
      }
      
      return false;
    });
  }, [projects]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    projects.forEach(p => {
      const year = new Date(p.receivedDate).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects, currentYear]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const date = new Date(p.receivedDate);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [projects, selectedMonth, selectedYear]);

  const totalRevenue = filteredProjects.reduce((acc, p) => 
    acc + p.environments
      .filter(env => env.completed)
      .reduce((sum, env) => sum + (env.value || 0), 0)
  , 0);

  const totalCommission = filteredProjects.reduce((acc, p) => {
    const completedTotal = p.environments
      .filter(env => env.completed)
      .reduce((sum, env) => sum + (env.value || 0), 0);
    return acc + (completedTotal * (p.commissionPercentage / 100));
  }, 0);

  const activeProjectsCount = filteredProjects.filter(p => p.status !== ProjectStatus.FINALIZADO).length;
  const completedProjectsCount = filteredProjects.filter(p => p.status === ProjectStatus.FINALIZADO).length;

  const statusData = Object.values(ProjectStatus).map(status => ({
    name: status,
    value: filteredProjects.filter(p => p.status === status).length
  }));

  const COLORS = ['#d1d5db', '#3b82f6', '#eab308', '#22c55e'];

  return (
    <div className="space-y-6">
      {/* Alertas Urgentes */}
      {urgentActions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            Ações Urgentes ({urgentActions.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentActions.slice(0, 6).map(p => (
              <div key={p.id} className="bg-white border border-red-100 p-3 rounded-lg shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-800 truncate">{p.clientName}</p>
                  <p className="text-[10px] text-stone-500">{p.status}</p>
                </div>
                <div className="mt-2 text-[10px] font-semibold text-red-600">
                  {p.status === ProjectStatus.ESPERA ? 'Atenção: Espera prolongada' : 'Atenção: Prazo crítico'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Header */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-stone-600">Mês:</label>
          <select 
            className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-stone-600">Ano:</label>
          <select 
            className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="sm:ml-auto">
          <span className="text-xs font-medium text-stone-400">
            Mostrando {filteredProjects.length} projetos em {MONTHS[selectedMonth]} de {selectedYear}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500 font-medium">Faturamento Concluído</p>
          <h3 className="text-2xl font-bold text-stone-800 mt-1">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          <p className="text-[10px] text-stone-400 mt-1">Apenas ambientes concluídos no período</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500 font-medium">Comissões Totais</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          <p className="text-[10px] text-stone-400 mt-1">Calculado sobre concluídos do período</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500 font-medium">Projetos Recebidos</p>
          <h3 className="text-2xl font-bold text-stone-800 mt-1">{filteredProjects.length}</h3>
          <p className="text-[10px] text-stone-400 mt-1">Total de entradas neste mês</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-sm text-stone-500 font-medium">Concluídos</p>
          <h3 className="text-2xl font-bold text-stone-800 mt-1">{completedProjectsCount}</h3>
          <p className="text-[10px] text-stone-400 mt-1">Status Finalizado no período</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <h4 className="text-lg font-semibold text-stone-800 mb-4">Projetos por Status ({MONTHS[selectedMonth]})</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <h4 className="text-lg font-semibold text-stone-800 mb-4">Composição de Status (%)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {filteredProjects.length > 0 ? (
                <PieChart>
                  <Pie
                    data={statusData.filter(d => d.value > 0)}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <div className="flex items-center justify-center h-full text-stone-400 italic text-sm">
                  Sem dados para exibir
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
