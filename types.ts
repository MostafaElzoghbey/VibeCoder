export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
  plan?: Plan; // Optional plan attached to a message
}

export interface Step {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface Plan {
  title: string;
  steps: Step[];
}

export interface File {
  name: string;
  language: string;
  content: string;
}

export interface GeneratedCode {
  files: File[];
  filesToDelete: string[];
  explanation: string;
}

export enum ViewMode {
  CODE = 'CODE',
  PREVIEW = 'PREVIEW',
}

export type ExecutionState = 'IDLE' | 'PLANNING' | 'WAITING_APPROVAL' | 'EXECUTING';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
  files: File[];
  messages: Message[];
  // Persist execution state to resume workflows
  executionState: ExecutionState;
  activePlanMessageId: number | null;
  currentStepIndex: number;
}
