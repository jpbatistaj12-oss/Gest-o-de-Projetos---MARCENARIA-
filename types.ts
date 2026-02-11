
export enum ProjectStatus {
  ESPERA = 'Em Espera',
  ANDAMENTO = 'Em Andamento',
  IMPEDIDO = 'Impedido',
  FINALIZADO = 'Finalizado'
}

export interface Environment {
  id: string;
  name: string;
  value: number;
  completed: boolean;
  material?: string;
}

export interface Project {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  orderNumber?: string;
  status: ProjectStatus;
  receivedDate: string;
  measurementDate?: string;
  deadlineDate?: string; // Novo campo para data de entrega programada
  finishedDate?: string;
  environments: Environment[];
  commissionPercentage: number;
  notes?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalCommissions: number;
  activeProjects: number;
  completedProjects: number;
}
