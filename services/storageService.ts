import { Project, File, Message, ExecutionState } from '../types';

const STORAGE_KEY = 'vibecoder_projects';
const ACTIVE_PROJECT_KEY = 'vibecoder_active_project_id';

// Default initial state for a new project
export const INITIAL_FILES: File[] = [
  {
    name: 'App.tsx',
    language: 'typescript',
    content: `
import React, { useState } from 'react';
import { Button } from './components/ui/Button';
import { Layout } from 'lucide-react';

export default function App() {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
          <Layout className="w-6 h-6" />
          <span>VibeCoder</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
          Ready to Build
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Describe your app in the chat to get started.
        </p>
        <Button onClick={() => setClicked(true)}>
          {clicked ? 'Let\\'s Go! 🚀' : 'Click Me'}
        </Button>
      </main>
    </div>
  );
}
`.trim()
  },
  {
    name: 'lib/utils.ts',
    language: 'typescript',
    content: `
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`.trim()
  },
  {
    name: 'components/ui/Button.tsx',
    language: 'typescript',
    content: `
import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: ButtonProps) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "bg-transparent border border-gray-200 text-gray-900 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10 p-2",
  };

  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
`.trim()
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{\n  "name": "vibe-coder-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1",\n    "lucide-react": "^0.263.1",\n    "clsx": "^2.0.0",\n    "tailwind-merge": "^2.0.0"\n  }\n}`
  }
];

export const createNewProject = (): Project => {
  const id = crypto.randomUUID();
  return {
    id,
    name: `Project ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    createdAt: Date.now(),
    lastModified: Date.now(),
    files: INITIAL_FILES,
    messages: [{
      role: 'model',
      content: "Hi! I'm VibeCoder. I've created a new project for you. What shall we build?",
      timestamp: Date.now()
    }],
    executionState: 'IDLE',
    activePlanMessageId: null,
    currentStepIndex: -1
  };
};

export const getProjects = (): Project[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load projects", e);
    return [];
  }
};

export const saveProject = (project: Project): void => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  project.lastModified = Date.now();
  
  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
};

export const deleteProject = (projectId: string): Project[] => {
  const projects = getProjects().filter(p => p.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  return projects;
};

export const getActiveProjectId = (): string | null => {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
};

export const loadActiveProject = (): Project => {
  const projects = getProjects();
  const activeId = getActiveProjectId();
  
  if (projects.length === 0) {
    const newProject = createNewProject();
    saveProject(newProject);
    return newProject;
  }
  
  const activeProject = projects.find(p => p.id === activeId);
  return activeProject || projects[0];
};
