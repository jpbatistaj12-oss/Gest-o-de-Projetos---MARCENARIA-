
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, ProjectStatus, Environment } from './types';
import { Icons, STATUS_COLORS } from './constants';
import ProjectForm from './components/ProjectForm';
import Dashboard from './components/Dashboard';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects'>('dashboard');
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('marmore-projects');
    return saved ? JSON.parse(saved) : [];
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'Todos'>('Todos');
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('marmore-projects', JSON.stringify(projects));
  }, [projects]);

  const getProjectAlerts = (project: Project) => {
    const alerts: { type: 'warning' | 'danger', message: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (project.status === ProjectStatus.ESPERA && project.measurementDate) {
      const mDate = new Date(project.measurementDate);
      const diffTime = Math.abs(today.getTime() - mDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        alerts.push({ type: 'danger', message: `Em espera há ${diffDays} dias após medição` });
      }
    }

    if (project.status !== ProjectStatus.FINALIZADO && project.deadlineDate) {
      const dDate = new Date(project.deadlineDate);
      const diffTime = dDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        alerts.push({ type: 'danger', message: `Projeto ATRASADO (${Math.abs(diffDays)} dias)` });
      } else if (diffDays <= 2) {
        alerts.push({ type: 'warning', message: `Prazo encerra em ${diffDays} dia(s)` });
      }
    }

    return alerts;
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        p.clientName.toLowerCase().includes(search) || 
        (p.orderNumber && p.orderNumber.toLowerCase().includes(search));
      const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const handleSaveProject = (project: Project) => {
    if (editingProject) {
      setProjects(projects.map(p => p.id === project.id ? project : p));
    } else {
      setProjects([...projects, project]);
    }
    setIsFormOpen(false);
    setEditingProject(undefined);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Deseja realmente excluir este projeto?')) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const fetchAiAnalysis = async (project: Project) => {
    if (aiAnalysis[project.id]) return;
    const summary = await geminiService.generateProjectSummary(project);
    setAiAnalysis(prev => ({ ...prev, [project.id]: summary }));
  };

  const calculateProjectTotal = (project: Project) => {
    return project.environments.reduce((sum, env) => sum + (env.value || 0), 0);
  };

  const calculateCompletedTotal = (project: Project) => {
    return project.environments
      .filter(env => env.completed)
      .reduce((sum, env) => sum + (env.value || 0), 0);
  };

  const calculateCommission = (project: Project) => {
    const total = calculateCompletedTotal(project);
    return total * (project.commissionPercentage / 100);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return;

      // Detectar delimitador (vírgula ou ponto-e-vírgula)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      const newProjects: Project[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Tentar mapear campos
        const clientName = row['cliente'] || row['nome'] || row['client'] || '';
        if (!clientName) continue;

        const orderNumber = row['pedido'] || row['order'] || row['numero'] || '';
        const email = row['email'] || row['e-mail'] || '';
        const phone = row['telefone'] || row['phone'] || row['celular'] || '';
        const statusStr = row['status'] || '';
        const valueStr = row['valor'] || row['total'] || '0';
        const notes = row['observacoes'] || row['notas'] || '';
        const commStr = row['comissao'] || row['%'] || '0';

        // Validar status
        let status = ProjectStatus.ESPERA;
        if (Object.values(ProjectStatus).includes(statusStr as ProjectStatus)) {
          status = statusStr as ProjectStatus;
        }

        const value = parseFloat(valueStr.replace(',', '.')) || 0;
        const commission = parseFloat(commStr.replace(',', '.')) || 0;

        const environments: Environment[] = [{
          id: crypto.randomUUID(),
          name: 'Ambiente Importado',
          value: value,
          completed: status === ProjectStatus.FINALIZADO
        }];

        newProjects.push({
          id: crypto.randomUUID(),
          clientName,
          clientEmail: email,
          clientPhone: phone,
          orderNumber: orderNumber,
          status,
          receivedDate: new Date().toISOString().split('T')[0],
          environments,
          commissionPercentage: commission,
          notes: notes
        });
      }

      if (newProjects.length > 0) {
        if (window.confirm(`Deseja importar ${newProjects.length} projetos da planilha?`)) {
          setProjects(prev => [...prev, ...newProjects]);
        }
      } else {
        alert("Não foi possível encontrar dados válidos na planilha. Certifique-se de que a primeira linha contém os cabeçalhos (ex: Cliente, Valor, Status).");
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) {
      alert("Não há projetos para exportar.");
      return;
    }

    const headers = [
      "Pedido",
      "Cliente",
      "Telefone",
      "E-mail",
      "Status",
      "Data Recebimento",
      "Data Medicao",
      "Prazo",
      "Data Finalizacao",
      "Ambientes",
      "Valor Total (R$)",
      "Valor Concluido (R$)",
      "% Comissao",
      "Valor Comissao (R$)",
      "Observacoes"
    ];

    const rows = filteredProjects.map(p => {
      const total = calculateProjectTotal(p);
      const completed = calculateCompletedTotal(p);
      const commission = calculateCommission(p);
      const environmentsList = p.environments.map(e => `${e.name}${e.completed ? ' [Concluido]' : ''} (R$${e.value})`).join('; ');
      
      return [
        p.orderNumber || "-",
        p.clientName,
        p.clientPhone || "-",
        p.clientEmail || "-",
        p.status,
        p.receivedDate,
        p.measurementDate || "-",
        p.deadlineDate || "-",
        p.finishedDate || "-",
        `"${environmentsList}"`,
        total.toFixed(2),
        completed.toFixed(2),
        p.commissionPercentage.toString(),
        commission.toFixed(2),
        `"${(p.notes || "").replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `exportacao_projetos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-stone-900 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-xl">GP</div>
          <h1 className="text-xl font-bold tracking-tight">Gestão de Projetos</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <Icons.Home /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'projects' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:bg-stone-800'}`}
          >
            <Icons.Wallet /> Projetos
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-800 text-stone-500 text-xs px-2">
          © 2024 Gestão de Projetos v1.0
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">
              {activeTab === 'dashboard' ? 'Visão Geral' : 'Gestão de Projetos'}
            </h2>
            <p className="text-stone-500">Controle seus ambientes, valores e comissões</p>
          </div>
          <button
            onClick={() => {
              setEditingProject(undefined);
              setIsFormOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all"
          >
            <Icons.Plus /> Novo Projeto
          </button>
        </header>

        {activeTab === 'dashboard' ? (
          <Dashboard projects={projects} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar cliente ou pedido..."
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-stone-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm font-medium text-stone-500 whitespace-nowrap">Status:</span>
                  <select 
                    className="p-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'Todos')}
                  >
                    <option value="Todos">Todos os Status</option>
                    {Object.values(ProjectStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportCSV} 
                  accept=".csv" 
                  className="hidden" 
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
                  title="Importar projetos de uma planilha (CSV)"
                >
                  <Icons.Upload />
                  Importar CSV
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
                  title="Exportar projetos filtrados para CSV"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProjects.map((project) => {
                const alerts = getProjectAlerts(project);
                return (
                  <div key={project.id} className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group relative">
                    {alerts.length > 0 && (
                      <div className="absolute top-0 right-0 p-4 z-10">
                        {alerts.map((alert, idx) => (
                          <div key={idx} title={alert.message} className={`w-3 h-3 rounded-full mb-1 animate-pulse shadow-sm ${alert.type === 'danger' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        ))}
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                             <h3 className="text-lg font-bold text-stone-800">{project.clientName}</h3>
                             {project.orderNumber && (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200">
                                 {project.orderNumber}
                               </span>
                             )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[project.status]}`}>
                              {project.status}
                            </span>
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                              <span className="font-semibold text-stone-500">Recebido:</span> {new Date(project.receivedDate).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          {(project.clientPhone || project.clientEmail) && (
                            <div className="flex gap-3 mt-2">
                              {project.clientPhone && (
                                <span className="text-[10px] text-stone-400 flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                  {project.clientPhone}
                                </span>
                              )}
                              {project.clientEmail && (
                                <span className="text-[10px] text-stone-400 flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                  {project.clientEmail}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(project)} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <Icons.Edit />
                          </button>
                          <button onClick={() => handleDelete(project.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Icons.Trash />
                          </button>
                        </div>
                      </div>

                      {alerts.length > 0 && (
                        <div className="mb-4 space-y-1">
                          {alerts.map((alert, idx) => (
                            <div key={idx} className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 ${alert.type === 'danger' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              {alert.message.toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3 mb-6">
                        {project.environments.map(env => (
                          <div key={env.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                               {env.completed ? (
                                 <span className="text-green-500 text-xs font-bold">✓</span>
                               ) : (
                                 <div className="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
                               )}
                               <span className={env.completed ? "text-stone-800 font-medium" : "text-stone-500"}>{env.name}</span>
                            </div>
                            <span className={env.completed ? "font-bold text-stone-900" : "text-stone-400"}>R$ {(env.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        {project.environments.length === 0 && <p className="text-xs text-stone-400 italic">Nenhum ambiente cadastrado</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 rounded-lg border border-stone-100">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Total Concluído</p>
                          <p className="text-lg font-bold text-stone-900">R$ {calculateCompletedTotal(project).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[9px] text-stone-400">De R$ {calculateProjectTotal(project).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Comissão ({project.commissionPercentage.toString().replace('.', ',')}%)</p>
                          <p className="text-lg font-bold text-emerald-600">R$ {calculateCommission(project).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[9px] text-stone-400">Sobre valor concluído</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap gap-x-4 gap-y-2">
                         {project.deadlineDate && (
                           <div className={`text-xs font-medium flex items-center gap-1 ${alerts.some(a => a.message.includes('prazo') || a.message.includes('ATRASADO')) ? 'text-red-600' : 'text-stone-500'}`}>
                              <Icons.Calendar /> Prazo: {new Date(project.deadlineDate).toLocaleDateString('pt-BR')}
                           </div>
                         )}
                         {project.measurementDate && (
                           <div className="text-xs text-blue-500 font-medium flex items-center gap-1">
                              <Icons.Calendar /> Medição: {new Date(project.measurementDate).toLocaleDateString('pt-BR')}
                           </div>
                         )}
                         {project.status === ProjectStatus.FINALIZADO && project.finishedDate && (
                            <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                               ✓ Finalizado em {new Date(project.finishedDate).toLocaleDateString('pt-BR')}
                            </div>
                         )}
                      </div>

                      <div className="mt-4">
                        <button 
                          onClick={() => fetchAiAnalysis(project)}
                          className="text-xs text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1"
                        >
                           Gerar insight da IA
                        </button>
                        {aiAnalysis[project.id] && (
                          <div className="mt-2 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-100 italic">
                            "{aiAnalysis[project.id]}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProjects.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icons.Wallet />
                  </div>
                  <h3 className="text-stone-600 font-medium">Nenhum projeto encontrado</h3>
                  <p className="text-stone-400 text-sm">Tente ajustar seus filtros ou clique em "Novo Projeto"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-stone-800">
                {editingProject ? 'Editar Projeto' : 'Cadastrar Novo Projeto'}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6">
              <ProjectForm 
                project={editingProject} 
                onSave={handleSaveProject} 
                onCancel={() => setIsFormOpen(false)} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
