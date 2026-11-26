import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ViewMode, Message, File, Plan, Project, ExecutionState } from './types';
import ChatInterface from './components/ChatInterface';
import PreviewFrame from './components/PreviewFrame';
import CodeViewer from './components/CodeViewer';
import FileExplorer from './components/FileExplorer';
import ProjectSidebar from './components/ProjectSidebar';
import { generateCodeFromPrompt, generateProjectPlan } from './services/geminiService';
import { 
    saveProject, 
    loadActiveProject, 
    createNewProject, 
    getProjects, 
    deleteProject 
} from './services/storageService';
import { Eye, Code, Terminal, RefreshCw, Menu } from 'lucide-react';

export default function App() {
  // --- Initialization ---
  // Load the initial project state synchronously to avoid flash
  const initialProject = useRef(loadActiveProject()).current;

  // --- State Management ---
  // Core Project State
  const [currentProjectId, setCurrentProjectId] = useState<string>(initialProject.id);
  const [projectName, setProjectName] = useState<string>(initialProject.name);
  const [files, setFiles] = useState<File[]>(initialProject.files);
  const [messages, setMessages] = useState<Message[]>(initialProject.messages);
  
  // Execution State (Planning/Coding)
  const [executionState, setExecutionState] = useState<ExecutionState>(initialProject.executionState);
  const [activePlanMessageId, setActivePlanMessageId] = useState<number | null>(initialProject.activePlanMessageId);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialProject.currentStepIndex);

  // UI State
  const [activeFile, setActiveFile] = useState<string>('App.tsx');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PREVIEW);
  const [previewKey, setPreviewKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Derived State
  const activeFileContent = files.find(f => f.name === activeFile)?.content || '';

  // --- Auto-Save Logic ---
  useEffect(() => {
    if (!currentProjectId) return;

    const projectToSave: Project = {
        id: currentProjectId,
        name: projectName,
        createdAt: initialProject.createdAt, // This technically shouldn't change, but simplifies
        lastModified: Date.now(),
        files,
        messages,
        executionState,
        activePlanMessageId,
        currentStepIndex
    };

    saveProject(projectToSave);
  }, [files, messages, executionState, activePlanMessageId, currentStepIndex, currentProjectId, projectName, initialProject.createdAt]);

  // --- Project Management Handlers ---
  const handleCreateProject = () => {
    const newProject = createNewProject();
    loadProjectIntoState(newProject);
    setIsSidebarOpen(false); // Close sidebar after creating
  };

  const handleSwitchProject = (id: string) => {
    const projects = getProjects();
    const target = projects.find(p => p.id === id);
    if (target) {
        loadProjectIntoState(target);
    }
  };

  const handleDeleteProject = (id: string) => {
    const remaining = deleteProject(id);
    if (currentProjectId === id) {
        // If we deleted the active project, switch to another or create new
        if (remaining.length > 0) {
            loadProjectIntoState(remaining[0]);
        } else {
            handleCreateProject();
        }
    }
  };

  const loadProjectIntoState = (project: Project) => {
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setFiles(project.files);
    setMessages(project.messages);
    setExecutionState(project.executionState);
    setActivePlanMessageId(project.activePlanMessageId);
    setCurrentStepIndex(project.currentStepIndex);
    setActiveFile('App.tsx');
    setPreviewKey(k => k + 1);
  };

  // --- File/Folder Handlers ---
  const handleCreateFolder = (parentPath: string, folderName: string) => {
    if (!folderName || folderName.trim() === "") return;
    if (folderName.includes('/')) {
        alert("Folder names cannot contain '/'.");
        return;
    }
    
    // Create a .keep file to persist the folder
    const fullPath = parentPath ? `${parentPath}/${folderName}/.keep` : `${folderName}/.keep`;
    
    if (files.some(f => f.name === fullPath)) return;
    
    setFiles(prev => [...prev, {
        name: fullPath,
        language: 'plaintext',
        content: ''
    }]);
  };

  const handleCreateFile = (parentPath: string, fileName: string) => {
     if (!fileName || fileName.trim() === "") return;
     if (fileName.includes('/')) {
        alert("File names cannot contain '/'. Use folder creation instead.");
        return;
     }
     
     const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;
     
     if (files.some(f => f.name === fullPath)) {
         alert("File already exists");
         return;
     }
     
     setFiles(prev => [...prev, {
         name: fullPath,
         language: 'typescript', // Default to typescript
         content: ''
     }]);
     setActiveFile(fullPath);
  };

  const handleMoveFile = (sourcePath: string, targetFolder: string) => {
    // Basic validations
    if (sourcePath === targetFolder) return;
    
    // Cannot move a folder into its own subdirectory
    if (targetFolder.startsWith(sourcePath + '/')) {
        return;
    }

    setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        const isFolder = !prevFiles.some(f => f.name === sourcePath); // Simple check if exactly matches a file

        if (!isFolder) {
            // Moving a specific file
            const file = newFiles.find(f => f.name === sourcePath);
            if (!file) return prevFiles; // Should not happen

            const fileName = sourcePath.split('/').pop();
            const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName!;
            
            // Check if exists
            if (newFiles.some(f => f.name === newPath)) {
                 // optionally alert or overwrite. For now, abort.
                 return prevFiles;
            }
            
            file.name = newPath;
            
            // Update active file if we just moved it
            if (activeFile === sourcePath) {
                setActiveFile(newPath);
            }
        } else {
            // Moving a folder (renaming prefix for all contained files)
            const folderName = sourcePath.split('/').pop();
            
            // Find all files that are children of sourcePath
            const affectedFiles = newFiles.filter(f => f.name.startsWith(sourcePath + '/'));
            if (affectedFiles.length === 0) return prevFiles;

            affectedFiles.forEach(f => {
                const suffix = f.name.substring(sourcePath.length);
                const newPath = targetFolder 
                    ? `${targetFolder}/${folderName}${suffix}` 
                    : `${folderName}${suffix}`;
                
                // Update active file if it was inside the moved folder
                if (activeFile === f.name) {
                    setActiveFile(newPath);
                }
                
                f.name = newPath;
            });
        }
        
        return newFiles;
    });
  };

  const handleRenameNode = (oldPath: string, newName: string) => {
      // 1. Get the parent path
      const pathParts = oldPath.split('/');
      const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      
      if (oldPath === newPath) return;

      // Check for collision (basic check)
      if (files.some(f => f.name === newPath || f.name.startsWith(newPath + '/'))) {
          alert("A file or folder with this name already exists");
          return;
      }

      setFiles(prev => {
          const next = prev.map(f => {
              if (f.name === oldPath) {
                  return { ...f, name: newPath };
              }
              if (f.name.startsWith(oldPath + '/')) {
                  const suffix = f.name.substring(oldPath.length);
                  return { ...f, name: newPath + suffix };
              }
              return f;
          });
          return next;
      });

      // Update active file if needed
      if (activeFile === oldPath) {
          setActiveFile(newPath);
      } else if (activeFile.startsWith(oldPath + '/')) {
          const suffix = activeFile.substring(oldPath.length);
          setActiveFile(newPath + suffix);
      }
  };

  const handleDeleteNode = (path: string) => {
      if (path === 'App.tsx') {
          alert("Cannot delete root entry file.");
          return;
      }
      
      // Delete the file OR any files that start with path + '/' (folder contents)
      setFiles(prev => prev.filter(f => 
          f.name !== path && !f.name.startsWith(path + '/')
      ));
      
      if (activeFile === path || activeFile.startsWith(path + '/')) {
          setActiveFile('App.tsx');
      }
  };

  // --- AI Logic (Planning & Coding) ---
  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    // Smart naming: If it's the first user prompt and project name is generic, rename it
    if (messages.filter(m => m.role === 'user').length === 0) {
        // Simple heuristic: Use first 4 words of prompt
        const smartName = input.split(' ').slice(0, 4).join(' ');
        setProjectName(smartName.length > 30 ? smartName.substring(0, 30) + '...' : smartName);
    }

    // Reset previous plan states if we are starting new workflow
    if (executionState === 'IDLE' || executionState === 'WAITING_APPROVAL') {
        setExecutionState('PLANNING');
        setActivePlanMessageId(null);
        setCurrentStepIndex(-1);
    }

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const plan = await generateProjectPlan(input, files);
      
      const planMessage: Message = {
        role: 'model',
        content: `I've created a plan for: ${plan.title}`,
        timestamp: Date.now(),
        plan: plan
      };

      setMessages(prev => [...prev, planMessage]);
      setExecutionState('WAITING_APPROVAL');

    } catch (error) {
      console.error(error);
      const errorDetail = error instanceof Error ? error.message : "Please try again.";
      setMessages(prev => [...prev, {
        role: 'model',
        content: `Planning error: ${errorDetail}`,
        timestamp: Date.now(),
        isError: true
      }]);
      setExecutionState('IDLE');
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, files, executionState, messages]);

  const handleApprovePlan = (messageIndex: number) => {
      setActivePlanMessageId(messageIndex);
      setExecutionState('EXECUTING');
      setCurrentStepIndex(0); 
  };

  const handleRetryStep = (messageIndex: number, stepIndex: number) => {
      if (isGenerating) return;
      setActivePlanMessageId(messageIndex);
      setExecutionState('EXECUTING');
      setCurrentStepIndex(stepIndex);
  };

  // --- Execution Loop ---
  // Using a ref to access latest state inside async operation without stale closures
  const stateRef = useRef({ files, messages });
  useEffect(() => { stateRef.current = { files, messages }; }, [files, messages]);
  const inFlightStepRef = useRef<string | null>(null);

  useEffect(() => {
    const executeStep = async () => {
        if (executionState !== 'EXECUTING' || activePlanMessageId === null || currentStepIndex === -1) return;

        const stepRunKey = `${activePlanMessageId}:${currentStepIndex}`;
        if (inFlightStepRef.current === stepRunKey) return;
        
        // Use functional state updates to avoid dependency loops, but read from ref for latest "snapshot" if needed
        const currentMessages = stateRef.current.messages;
        const planMessage = currentMessages[activePlanMessageId];
        
        if (!planMessage || !planMessage.plan) return;

        const steps = planMessage.plan.steps;
        if (currentStepIndex >= steps.length) {
            setExecutionState('IDLE');
            setMessages(prev => [...prev, {
                role: 'model',
                content: "All steps completed! You can now test the application or request further changes.",
                timestamp: Date.now()
            }]);
            return;
        }

        const currentStep = steps[currentStepIndex];
        inFlightStepRef.current = stepRunKey;
        
        // Update Step Status to RUNNING
        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs[activePlanMessageId]?.plan) {
                // Create a shallow copy of the plan and steps to trigger re-render
                const plan = newMsgs[activePlanMessageId].plan!;
                const newSteps = [...plan.steps];
                newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'running' };
                newMsgs[activePlanMessageId] = { ...newMsgs[activePlanMessageId], plan: { ...plan, steps: newSteps } };
            }
            return newMsgs;
        });

        setIsGenerating(true);

        try {
            // Generate Code
            const historyParts = currentMessages
                .filter(m => !m.plan && !m.isError && m.content.trim().length > 0)
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.content }]
                }));

            const stepPrompt = `Execute Step ${currentStep.id}: ${currentStep.title}. \nInstructions: ${currentStep.description}`;
            
            // Pass current files
            const { files: newFiles, filesToDelete, explanation } = await generateCodeFromPrompt(stepPrompt, historyParts, stateRef.current.files);

            // Update Files
            setFiles(prev => {
                let updatedFiles = [...prev];
                if (filesToDelete.length > 0) {
                    updatedFiles = updatedFiles.filter(f => !filesToDelete.includes(f.name));
                }
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

            // Update Step Status to COMPLETED
            setMessages(prev => {
                const newMsgs = [...prev];
                if (newMsgs[activePlanMessageId]?.plan) {
                    const plan = newMsgs[activePlanMessageId].plan!;
                    const newSteps = [...plan.steps];
                    newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'completed' };
                    newMsgs[activePlanMessageId] = { ...newMsgs[activePlanMessageId], plan: { ...plan, steps: newSteps } };
                }
                // Add completion message
                newMsgs.push({
                    role: 'model',
                    content: `Completed Step ${currentStep.id}: ${explanation || currentStep.title}`,
                    timestamp: Date.now()
                });
                return newMsgs;
            });
            
            setPreviewKey(k => k + 1);
            if (newFiles.length > 0) {
                 // If App.tsx was modified, focus it, otherwise focus the first new file
                 if (newFiles.some(f => f.name === 'App.tsx')) {
                     setActiveFile('App.tsx');
                 } else {
                     setActiveFile(newFiles[0].name);
                 }
            }

            // Move to next step
            setCurrentStepIndex(prev => prev + 1);

        } catch (err) {
            console.error("Step Execution Error", err);
            const errorDetail = err instanceof Error ? err.message : "Unknown error";
            setMessages(prev => {
                const newMsgs = [...prev];
                 if (newMsgs[activePlanMessageId]?.plan) {
                    const plan = newMsgs[activePlanMessageId].plan!;
                    const newSteps = [...plan.steps];
                    newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'failed' };
                    newMsgs[activePlanMessageId] = { ...newMsgs[activePlanMessageId], plan: { ...plan, steps: newSteps } };
                }
                newMsgs.push({
                    role: 'model',
                    content: `Error executing step ${currentStep.id}: ${errorDetail}. Execution paused.`,
                    timestamp: Date.now(),
                    isError: true
                });
                return newMsgs;
            });
            setExecutionState('IDLE');
        } finally {
            inFlightStepRef.current = null;
            setIsGenerating(false);
        }
    };

    executeStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, executionState, activePlanMessageId]);

  // --- Render Handlers ---
  const refreshPreview = () => setPreviewKey(k => k + 1);

  return (
    <div className="flex h-screen w-full bg-gray-950 text-white overflow-hidden font-sans">
      
      <ProjectSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={getProjects()}
        activeProjectId={currentProjectId}
        onSelectProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* File Explorer (Desktop) */}
      <div className="w-64 flex-shrink-0 flex flex-col h-full border-r border-gray-800 hidden md:flex">
        <FileExplorer 
          files={files} 
          activeFile={activeFile} 
          onFileSelect={setActiveFile} 
          onFileDelete={handleDeleteNode}
          projectName={projectName}
          onShowProjects={() => setIsSidebarOpen(true)}
          onCreateProject={handleCreateProject}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onFileMove={handleMoveFile}
          onRenameNode={handleRenameNode}
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
          onApprovePlan={handleApprovePlan}
          onRetryStep={handleRetryStep}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-900 relative">
        
        {/* Toolbar */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
             >
                <Menu className="w-5 h-5" />
             </button>
            <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                {projectName}
            </span>
            <div className="h-4 w-[1px] bg-gray-700 mx-1" />
            <span className="text-sm text-gray-400 flex items-center gap-2">
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
              <CodeViewer code={activeFileContent} fileName={activeFile} />
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
