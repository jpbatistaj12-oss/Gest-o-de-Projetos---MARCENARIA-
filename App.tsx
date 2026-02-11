
import React, { useState, useEffect, useMemo } from 'react';
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
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    return localStorage.getItem('marmore-sheet-url') || '';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'Todos'>('Todos');

  useEffect(() => {
    localStorage.setItem('marmore-projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('marmore-sheet-url', sheetUrl);
  }, [sheetUrl]);

  // Função para converter link do Google Sheets em link de exportação CSV
  const convertToCsvUrl = (url: string) => {
    if (url.includes('/edit')) {
      return url.replace(/\/edit.*$/, '/export?format=csv');
    }
    if (url.includes('/pubhtml')) {
      return url.replace('/pubhtml', '/pub?output=csv');
    }
    return url;
  };

  const parseCsvLine = (text: string) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleSyncGoogleSheet = async (url: string) => {
    if (!url) return;
    setIsSyncing(true);
    try {
      const csvUrl = convertToCsvUrl(url);
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      
      const newProjects: Project[] = [];
      
      // Itera as linhas procurando dados na parte de "PROJETOS LIBERADOS"
      // De acordo com o CSV enviado, os dados de projetos liberados começam na Coluna G (index 6)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.trim() === '') continue;
        
        const cleanValues = parseCsvLine(line);
        
        // Se a linha for muito curta, ignora
        if (cleanValues.length < 10) continue;

        // Mapeamento baseado na planilha enviada:
        // Coluna G (6): DATA
        // Coluna H (7): CLIENTE
        // Coluna I (8): AMBIENTE
        // Coluna J (9): MEDIÇÃO (Info extra)
        // Coluna K (10): PEDIDO
        // Coluna L (11): VALOR
        
        const dataStr = cleanValues[6];
        const cliente = cleanValues[7];
        const ambiente = cleanValues[8];
        const medicaoInfo = cleanValues[9];
        const pedido = cleanValues[10];
        const valorStr = cleanValues[11] || "";

        // Ignora cabeçalhos ou linhas vazias de cliente
        if (!cliente || cliente === "CLIENTE" || cliente === "JANEIRO" || cliente.length < 3) continue;

        const valorNumeric = parseFloat(
          valorStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
        ) || 0;

        // Criar ID único para evitar duplicatas na sincronização
        const syncId = `sheet-${pedido || 'no-ped'}-${cliente}-${ambiente}`;
        
        newProjects.push({
          id: syncId,
          clientName: cliente,
          orderNumber: pedido,
          receivedDate: dataStr || new Date().toISOString().split('T')[0],
          status: ProjectStatus.ANDAMENTO,
          environments: [{
            id: crypto.randomUUID(),
            name: ambiente || 'Geral',
            value: valorNumeric,
            completed: false
          }],
          commissionPercentage: 0.5,
          isExternal: true,
          notes: `Importado: ${medicaoInfo}`
        });
      }

      if (newProjects.length > 0) {
        setProjects(prev => {
          const manualOnes = prev.filter(p => !p.isExternal);
          // Agrupa ambientes de um mesmo pedido/cliente se necessário (opcional, aqui mantemos 1:1 com a linha da planilha)
          return [...manualOnes, ...newProjects];
        });
      } else {
        alert("Nenhum dado válido encontrado na parte de 'Projetos Liberados' da planilha.");
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao ler a planilha. Certifique-se de que o link está correto e a planilha tem permissão de leitura.");
    } finally {
      setIsSyncing(false);
    }
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-stone-900 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-xl">GP</div>
          <h1 className="text-xl font-bold tracking-tight">Marmoraria Pro</h1>
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
          
          <div className="pt-4 mt-4 border-t border-stone-800">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-stone-400 hover:bg-stone-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Planilha Google
            </button>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-800 text-stone-500 text-xs px-2">
          © 2024 Marmoraria v1.4
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">
              {activeTab === 'dashboard' ? 'Visão Geral' : 'Gestão de Projetos'}
            </h2>
            <p className="text-stone-500">Controle total da sua produção</p>
          </div>
          <div className="flex gap-2">
            {sheetUrl && (
               <button
                onClick={() => handleSyncGoogleSheet(sheetUrl)}
                disabled={isSyncing}
                className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition-all disabled:opacity-50"
              >
                <svg className={isSyncing ? 'animate-spin' : ''} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
            <button
              onClick={() => {
                setEditingProject(undefined);
                setIsFormOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all"
            >
              <Icons.Plus /> Novo Projeto
            </button>
          </div>
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProjects.map((project) => {
                const hasIncomplete = project.environments.some(env => !env.completed);
                const isFinalized = project.status === ProjectStatus.FINALIZADO;

                return (
                  <div key={project.id} className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group relative">
                    {project.isExternal && (
                      <div className="absolute top-0 left-0 px-2 py-0.5 bg-emerald-500 text-[9px] text-white font-bold rounded-br-lg z-10">
                        SINC PLANILHA
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                             <h3 className="text-lg font-bold text-stone-800 truncate">{project.clientName}</h3>
                             {project.orderNumber && (
                               <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200">
                                 #{project.orderNumber}
                               </span>
                             )}
                             {hasIncomplete && !isFinalized && (
                               <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-200 animate-subtle-pulse">
                                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                 PENDENTE
                               </span>
                             )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[project.status]}`}>
                              {project.status}
                            </span>
                            <span className="text-xs text-stone-400">
                               {project.receivedDate}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEdit(project)} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <Icons.Edit />
                          </button>
                          {!project.isExternal && (
                            <button onClick={() => handleDelete(project.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Icons.Trash />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-6 max-h-32 overflow-y-auto pr-1">
                        {project.environments.map(env => (
                          <div key={env.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                               {env.completed ? (
                                 <span className="text-emerald-500 font-bold">✓</span>
                               ) : (
                                 <div className="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
                               )}
                               <span className={env.completed ? "text-stone-800 font-medium" : "text-stone-400 italic"}>
                                 {env.name}
                               </span>
                            </div>
                            <span className={env.completed ? "font-bold text-stone-900" : "text-stone-300"}>
                              R$ {(env.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 rounded-lg border border-stone-100">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Total Projeto</p>
                          <p className="text-lg font-bold text-stone-900">R$ {calculateProjectTotal(project).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Comissão ({project.commissionPercentage}%)</p>
                          <p className="text-lg font-bold text-emerald-600">R$ {calculateCommission(project).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal Settings */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-stone-800">Sincronização Google</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-stone-400 hover:text-stone-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-stone-500">
                Cole o link da sua planilha do Google. O sistema cuidará do resto!
              </p>
              <input 
                type="text" 
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full p-3 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => {
                    handleSyncGoogleSheet(sheetUrl);
                    setIsSettingsOpen(false);
                  }}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Salvar e Atualizar
                </button>
                <button 
                  onClick={() => { setSheetUrl(''); setProjects(p => p.filter(x => !x.isExternal)); setIsSettingsOpen(false); }}
                  className="px-4 border border-stone-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  Limpar
                </button>
              </div>
              <p className="text-[10px] text-stone-400 italic mt-2">
                Nota: Certifique-se de que a planilha está compartilhada como "Qualquer pessoa com o link pode ler".
              </p>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-stone-800">
                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="text-stone-400 hover:text-stone-600">
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
