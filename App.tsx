import React, { useState, useCallback } from 'react';
import { ViewMode, Message, File } from './types';
import ChatInterface from './components/ChatInterface';
import PreviewFrame from './components/PreviewFrame';
import CodeViewer from './components/CodeViewer';
import FileExplorer from './components/FileExplorer';
import { generateCodeFromPrompt } from './services/geminiService';
import { Eye, Code, Layout as LayoutIcon, Terminal, ExternalLink, RefreshCw } from 'lucide-react';

// Initial sample code
const INITIAL_CODE = `
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
        <nav className="flex gap-4 text-sm font-medium text-gray-500">
          <a href="#" className="hover:text-gray-900 transition-colors">Docs</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Components</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Blog</a>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-4 sm:text-5xl">
            Build React apps with <span className="text-indigo-600">Vibe</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Describe what you want, and I'll build it using clean code, Tailwind CSS, and standard folder structures.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Ready to start?</h2>
            <p className="text-gray-500">Click the button to see interactivity.</p>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => setClicked(!clicked)}
            className="animate-in zoom-in duration-300"
          >
            {clicked ? 'Vibe Check Passed ✅' : 'Start Building'}
          </Button>
        </div>
        
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
           <FeatureCard title="Modern Stack" desc="React 18 + Tailwind CSS + Lucide Icons" />
           <FeatureCard title="Clean Code" desc="Modular components with proper folder structure" />
           <FeatureCard title="AI Powered" desc="Powered by Gemini 2.0 Flash for instant results" />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
`;

const UTILS_CODE = `
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

const BUTTON_CODE = `
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
`;

const INITIAL_FILES: File[] = [
  {
    name: 'App.tsx',
    language: 'typescript',
    content: INITIAL_CODE.trim()
  },
  {
    name: 'lib/utils.ts',
    language: 'typescript',
    content: UTILS_CODE.trim()
  },
  {
    name: 'components/ui/Button.tsx',
    language: 'typescript',
    content: BUTTON_CODE.trim()
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{\n  "name": "vibe-coder-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1",\n    "lucide-react": "^0.263.1",\n    "clsx": "^2.0.0",\n    "tailwind-merge": "^2.0.0"\n  }\n}`
  },
  {
    name: 'readme.md',
    language: 'markdown',
    content: `# Vibe Coder Project\n\nGenerated with AI.`
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'model',
    content: "Hi! I'm VibeCoder. Describe an app or component you want me to build with React and Tailwind. I'll use standard folders like `components/ui` and `lib/utils`.",
    timestamp: Date.now()
  }]);
  
  const [files, setFiles] = useState<File[]>(INITIAL_FILES);
  const [activeFile, setActiveFile] = useState<string>('App.tsx');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PREVIEW);
  const [previewKey, setPreviewKey] = useState(0);

  const activeFileContent = files.find(f => f.name === activeFile)?.content || '';

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const historyParts = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // Pass the current files state to the service
      const { files: newFiles, filesToDelete, explanation } = await generateCodeFromPrompt(input, historyParts, files);

      setMessages(prev => [...prev, {
        role: 'model',
        content: explanation,
        timestamp: Date.now()
      }]);

      if (newFiles.length > 0 || filesToDelete.length > 0) {
        setFiles(prev => {
          let updatedFiles = [...prev];

          // Handle Deletes
          if (filesToDelete.length > 0) {
            updatedFiles = updatedFiles.filter(f => !filesToDelete.includes(f.name));
          }

          // Handle Updates & Creates
          newFiles.forEach(newFile => {
            const index = updatedFiles.findIndex(f => f.name === newFile.name);
            if (index >= 0) {
              updatedFiles[index] = newFile;
            } else {
              updatedFiles.push(newFile);
            }
          });
          
          return updatedFiles;
        });

        // Switch to preview and refresh
        setViewMode(ViewMode.PREVIEW);
        setPreviewKey(k => k + 1);
        
        // Logic to decide which file to show in code view
        if (newFiles.length > 0) {
            if (newFiles.some(f => f.name === 'App.tsx')) {
                setActiveFile('App.tsx');
            } else {
                setActiveFile(newFiles[0].name);
            }
        } else if (filesToDelete.includes(activeFile)) {
             setActiveFile('App.tsx');
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'model',
        content: "Sorry, I encountered an error while generating the code. Please try again.",
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, messages, activeFile, files]);

  const refreshPreview = () => {
    setPreviewKey(k => k + 1);
  };

  const handleDeleteFile = (fileName: string) => {
    if (fileName === 'App.tsx') return;
    
    setFiles(prev => prev.filter(f => f.name !== fileName));
    
    // If we deleted the active file, switch to App.tsx
    if (activeFile === fileName) {
      setActiveFile('App.tsx');
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* File Explorer */}
      <div className="w-64 flex-shrink-0 flex flex-col h-full border-r border-gray-800 hidden md:flex">
        <FileExplorer 
          files={files} 
          activeFile={activeFile} 
          onFileSelect={setActiveFile} 
          onFileDelete={handleDeleteFile}
        />
      </div>

      {/* Chat Area */}
      <div className="w-[350px] flex-shrink-0 flex flex-col h-full z-10 border-r border-gray-800">
        <ChatInterface 
          messages={messages}
          input={input}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onSend={handleSend}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-900 relative">
        
        {/* Toolbar */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              {activeFile}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {viewMode === ViewMode.PREVIEW && (
              <button 
                onClick={refreshPreview}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                title="Refresh Preview"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => setViewMode(ViewMode.PREVIEW)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === ViewMode.PREVIEW
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => setViewMode(ViewMode.CODE)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === ViewMode.CODE
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code className="w-4 h-4" />
                Code
              </button>
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 relative bg-black/50 overflow-hidden">
          {viewMode === ViewMode.PREVIEW ? (
             <div className="w-full h-full" key={previewKey}>
               <PreviewFrame files={files} />
             </div>
          ) : (
            <div className="w-full h-full">
              <CodeViewer code={activeFileContent} />
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
