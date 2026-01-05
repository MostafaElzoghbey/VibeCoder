import React, { useState, useCallback } from 'react';
import { ViewMode, Message, File } from './types';
import ChatInterface from './components/ChatInterface';
import PreviewFrame from './components/PreviewFrame';
import CodeViewer from './components/CodeViewer';
import FileExplorer from './components/FileExplorer';
import { generateCodeFromPrompt } from './services/geminiService';
import { Eye, Code, Layout, Terminal, ExternalLink, RefreshCw } from 'lucide-react';

// Initial sample code
const INITIAL_CODE = `
import React, { useState } from 'react';

export default function App() {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-gray-100 max-w-md mx-auto">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready to Vibe Code?</h1>
        <p className="text-gray-500 mb-6">Describe the app you want to build in the chat on the left.</p>
        <button 
          onClick={() => setClicked(!clicked)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
        >
          {clicked ? 'Lets Go!' : 'Start Generating'}
        </button>
      </div>
    </div>
  );
}
`;

const INITIAL_FILES: File[] = [
  {
    name: 'App.tsx',
    language: 'typescript',
    content: INITIAL_CODE.trim()
  },
  {
    name: 'package.json',
    language: 'json',
    content: `{\n  "name": "vibe-coder-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0",\n    "lucide-react": "^0.263.1"\n  }\n}`
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
    content: "Hi! I'm VibeCoder. Describe an app or component you want me to build with React and Tailwind.",
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

      const { files: newFiles, filesToDelete, explanation } = await generateCodeFromPrompt(input, historyParts);

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
      setMessages(prev => [...prev, {
        role: 'model',
        content: "Sorry, I encountered an error while generating the code. Please try again.",
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, messages, activeFile]);

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
