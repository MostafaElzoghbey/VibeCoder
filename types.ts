export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
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
