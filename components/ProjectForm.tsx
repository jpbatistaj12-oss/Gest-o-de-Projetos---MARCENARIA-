
import React, { useState, useEffect } from 'react';
import { Project, ProjectStatus, Environment } from '../types';
import { Icons } from '../constants';

interface ProjectFormProps {
  project?: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSave, onCancel }) => {
  const [clientName, setClientName] = useState(project?.clientName || '');
  const [clientEmail, setClientEmail] = useState(project?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(project?.clientPhone || '');
  const [orderNumber, setOrderNumber] = useState(project?.orderNumber || '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || ProjectStatus.ESPERA);
  const [receivedDate, setReceivedDate] = useState(project?.receivedDate || new Date().toISOString().split('T')[0]);
  const [measurementDate, setMeasurementDate] = useState(project?.measurementDate || '');
  const [deadlineDate, setDeadlineDate] = useState(project?.deadlineDate || '');
  const [finishedDate, setFinishedDate] = useState(project?.finishedDate || '');
  const [commissionPercentage, setCommissionPercentage] = useState(project?.commissionPercentage || 0);
  const [environments, setEnvironments] = useState<Environment[]>(project?.environments || []);
  const [notes, setNotes] = useState(project?.notes || '');

  const addEnvironment = () => {
    setEnvironments([...environments, { id: crypto.randomUUID(), name: '', value: 0, completed: false }]);
  };

  const updateEnvironment = (id: string, field: keyof Environment, value: any) => {
    setEnvironments(environments.map(env => env.id === id ? { ...env, [field]: value } : env));
  };

  const removeEnvironment = (id: string) => {
    setEnvironments(environments.filter(env => env.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: project?.id || crypto.randomUUID(),
      clientName,
      clientEmail,
      clientPhone,
      orderNumber,
      status,
      receivedDate,
      measurementDate,
      deadlineDate,
      finishedDate: status === ProjectStatus.FINALIZADO ? (finishedDate || new Date().toISOString().split('T')[0]) : finishedDate,
      environments,
      commissionPercentage,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase text-stone-400 tracking-wider border-b pb-1">Informações do Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
            <input
              required
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número do Pedido</label>
            <input
              type="text"
              placeholder="Ex: #1234"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="cliente@email.com"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-bold uppercase text-stone-400 tracking-wider border-b pb-1">Status e Prazos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status do Projeto</label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {Object.values(ProjectStatus).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Recebimento</label>
            <input
              required
              type="date"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data da Medição</label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Entrega (Prazo)</label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-stone-800">Ambientes</h3>
          <button
            type="button"
            onClick={addEnvironment}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1 rounded-md text-sm font-medium transition-colors"
          >
            <Icons.Plus /> Adicionar Ambiente
          </button>
        </div>
        
        <div className="space-y-3">
          {environments.map((env) => (
            <div key={env.id} className="flex gap-3 items-end bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Ambiente</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Cozinha"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  value={env.name}
                  onChange={(e) => updateEnvironment(env.id, 'name', e.target.value)}
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  value={env.value}
                  onChange={(e) => updateEnvironment(env.id, 'value', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col items-center mb-1">
                 <label className="text-[10px] font-bold text-gray-400 mb-1">CONCLUÍDO</label>
                 <button
                    type="button"
                    onClick={() => updateEnvironment(env.id, 'completed', !env.completed)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${env.completed ? 'bg-green-500 text-white border-green-600' : 'bg-white text-gray-300 border-gray-200 hover:border-gray-400'}`}
                 >
                    {env.completed ? '✓' : ''}
                 </button>
              </div>
              <button
                type="button"
                onClick={() => removeEnvironment(env.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors mb-1"
              >
                <Icons.Trash />
              </button>
            </div>
          ))}
          {environments.length === 0 && (
            <p className="text-center text-gray-500 py-4 italic">Nenhum ambiente adicionado ainda.</p>
          )}
        </div>
      </div>

      <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Porcentagem de Comissão (%)</label>
          <input
            type="number"
            step="0.01"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none"
            placeholder="Ex: 0,5"
            value={commissionPercentage}
            onChange={(e) => setCommissionPercentage(parseFloat(e.target.value) || 0)}
          />
          <p className="text-[10px] text-stone-400 mt-1">Valores decimais permitidos (ex: 0.4 ou 0.5)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-stone-500 outline-none h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 transition-colors font-medium shadow-sm"
        >
          Salvar Projeto
        </button>
      </div>
    </form>
  );
};

export default ProjectForm;
