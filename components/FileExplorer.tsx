import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileCode, FileJson, FileType, Folder, FolderOpen, 
  ChevronRight, ChevronDown, Trash2, Plus, LayoutGrid, History,
  FolderPlus, FilePlus, X, Edit2
} from 'lucide-react';
import { File } from '../types';

interface FileExplorerProps {
  files: File[];
  activeFile: string;
  onFileSelect: (fileName: string) => void;
  onFileDelete: (fileName: string) => void;
  projectName: string;
  onShowProjects: () => void;
  onCreateProject: () => void;
  onCreateFolder: (parentPath: string, name: string) => void;
  onCreateFile: (parentPath: string, name: string) => void;
  onFileMove: (sourcePath: string, targetFolder: string) => void;
  onRenameNode: (oldPath: string, newName: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface CreationState {
    type: 'file' | 'folder';
    parentPath: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  activeFile, 
  onFileSelect,
  onFileDelete,
  projectName,
  onShowProjects,
  onCreateProject,
  onCreateFolder,
  onCreateFile,
  onFileMove,
  onRenameNode
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['components', 'components/ui']));
  const [creationState, setCreationState] = useState<CreationState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creationState && inputRef.current) {
        inputRef.current.focus();
    }
  }, [creationState]);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [renamingPath]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const fileTree = useMemo(() => {
    const root: FileNode[] = [];
    
    files.forEach(file => {
      const isKeepFile = file.name.endsWith('.keep');
      const parts = file.name.split('/');
      let currentLevel = root;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        
        if (isFile && isKeepFile) return;

        const path = parts.slice(0, index + 1).join('/');
        
        let existingNode = currentLevel.find(node => node.path === path);
        
        if (!existingNode) {
          existingNode = {
            name: part,
            path: path,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : []
          };
          currentLevel.push(existingNode);
        }
        
        if (!isFile && existingNode.children) {
          currentLevel = existingNode.children;
        }
      });
    });

    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
      nodes.forEach(node => {
        if (node.children) sortNodes(node.children);
      });
    };
    
    sortNodes(root);
    return root;
  }, [files]);

  const handleDelete = (e: React.MouseEvent, node: FileNode) => {
    // Stop propagation to prevent selecting the file
    e.stopPropagation();
    
    const msg = node.type === 'folder' 
        ? `Delete folder "${node.name}" and all contents?` 
        : `Delete "${node.name}"?`;
    
    if (window.confirm(msg)) {
        onFileDelete(node.path);
    }
  };

  const handleStartCreate = (e: React.MouseEvent, parentPath: string, type: 'file' | 'folder') => {
      e.stopPropagation();
      if (parentPath && !expandedFolders.has(parentPath)) {
          toggleFolder(parentPath);
      }
      setCreationState({ type, parentPath });
  };

  const handleCreateSubmit = () => {
      if (!creationState || !inputRef.current) return;
      const name = inputRef.current.value.trim();
      
      if (name) {
          if (creationState.type === 'folder') {
              onCreateFolder(creationState.parentPath, name);
          } else {
              onCreateFile(creationState.parentPath, name);
          }
      }
      setCreationState(null);
  };

  const handleRenameSubmit = () => {
      if (!renamingPath || !renameInputRef.current) return;
      const newName = renameInputRef.current.value.trim();
      
      if (newName && newName !== renamingPath.split('/').pop()) {
          onRenameNode(renamingPath, newName);
      }
      setRenamingPath(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, isRename: boolean = false) => {
      if (e.key === 'Enter') {
          isRename ? handleRenameSubmit() : handleCreateSubmit();
      } else if (e.key === 'Escape') {
          isRename ? setRenamingPath(null) : setCreationState(null);
      }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
      e.stopPropagation();
      e.dataTransfer.setData('application/x-vibecoder-path', node.path);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, node: FileNode) => {
      e.preventDefault();
      e.stopPropagation();
      if (node.type === 'folder') {
          setDragOverId(node.path);
      }
  };

  const handleDrop = (e: React.DragEvent, targetNode?: FileNode) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
      
      const sourcePath = e.dataTransfer.getData('application/x-vibecoder-path');
      if (!sourcePath) return;

      const targetPath = targetNode ? targetNode.path : ''; 
      if (sourcePath === targetPath) return;
      
      onFileMove(sourcePath, targetPath);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId('ROOT_CONTAINER');
  };

  const handleRootDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(null);
      const sourcePath = e.dataTransfer.getData('application/x-vibecoder-path');
      if (sourcePath) {
         onFileMove(sourcePath, '');
      }
  };

  // Stop mousedown propagation for buttons/inputs to prevent parent drag
  const stopPropagation = (e: React.MouseEvent) => {
      e.stopPropagation();
  };


  const CreationInput = ({ depth }: { depth: number }) => (
    <div 
        className="flex items-center gap-1.5 py-1 px-2 border-l-2 border-transparent text-gray-400"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
        <span className="opacity-70 invisible"><ChevronRight className="w-3 h-3" /></span>
        <span className={creationState?.type === 'folder' ? 'text-blue-400' : 'text-gray-500'}>
            {creationState?.type === 'folder' ? <Folder className="w-3.5 h-3.5" /> : <FileType className="w-3.5 h-3.5" />}
        </span>
        <input 
            ref={inputRef}
            type="text"
            className="bg-gray-800 text-white text-sm px-1 py-0.5 rounded border border-indigo-500/50 focus:outline-none focus:border-indigo-500 w-full min-w-0"
            placeholder={creationState?.type === 'folder' ? 'Folder name' : 'File name'}
            onKeyDown={(e) => handleKeyDown(e, false)}
            onBlur={() => setCreationState(null)}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
        />
    </div>
  );

  const renderNode = (node: FileNode, depth: number) => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile === node.path;
    const isCreatingHere = creationState?.parentPath === node.path;
    const isDragOver = dragOverId === node.path;
    const isRenaming = renamingPath === node.path;
    
    return (
      <div key={node.path}>
        <div
          onClick={() => !isRenaming && (node.type === 'folder' ? toggleFolder(node.path) : onFileSelect(node.path))}
          draggable={!isRenaming}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          className={`group flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors text-sm border-l-2
            ${isActive && !isRenaming
                ? 'bg-indigo-600/10 text-indigo-300 border-indigo-500' 
                : isDragOver
                  ? 'bg-indigo-600/30 text-white border-indigo-400'
                  : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.type === 'folder' && (
            <span className="opacity-70 hover:text-white">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          )}
          
          <span className={`${node.type === 'folder' ? 'text-blue-400' : 'text-gray-500'}`}>
             {node.type === 'folder' 
                ? (isExpanded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />)
                : <FileIcon name={node.name} />
             }
          </span>
          
          {isRenaming ? (
               <input 
                  ref={renameInputRef}
                  type="text"
                  defaultValue={node.name}
                  className="bg-gray-800 text-white text-sm px-1 py-0.5 rounded border border-indigo-500/50 focus:outline-none focus:border-indigo-500 w-full min-w-0"
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  onBlur={handleRenameSubmit}
                  onClick={stopPropagation}
                  onMouseDown={stopPropagation}
              />
          ) : (
              <span className="truncate flex-1 select-none">{node.name}</span>
          )}
          
          {/* Node Actions */}
          {!isRenaming && (
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        setRenamingPath(node.path); 
                    }}
                    onMouseDown={stopPropagation}
                    className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded mr-1"
                    title="Rename"
                >
                    <Edit2 className="w-3 h-3" />
                </button>

                {node.type === 'folder' && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                handleStartCreate(e, node.path, 'file');
                            }}
                            onMouseDown={stopPropagation}
                            className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded mr-1"
                            title="New File"
                        >
                            <FilePlus className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                handleStartCreate(e, node.path, 'folder');
                            }}
                            onMouseDown={stopPropagation}
                            className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded mr-1"
                            title="New Folder"
                        >
                            <FolderPlus className="w-3 h-3" />
                        </button>
                    </>
                )}
                
                {node.name !== 'App.tsx' && (
                    <button
                        type="button"
                        onClick={(e) => handleDelete(e, node)}
                        onMouseDown={stopPropagation}
                        className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded"
                        title="Delete"
                    >
                    <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>
          )}
        </div>
        
        {node.type === 'folder' && isExpanded && (
          <div>
            {isCreatingHere && <CreationInput depth={depth + 1} />}
            {node.children && node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800 text-gray-400 select-none">
      {/* Project Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <LayoutGrid className="w-3 h-3" />
                VibeCoder
            </span>
            <div className="flex gap-1">
                 <button 
                    onClick={onShowProjects}
                    className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
                    title="Project History"
                 >
                    <History className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={onCreateProject}
                    className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
                    title="New Project"
                 >
                    <Plus className="w-4 h-4" />
                 </button>
            </div>
        </div>
        <div 
            onClick={onShowProjects}
            className="text-sm font-semibold text-white truncate hover:text-indigo-300 cursor-pointer transition-colors flex items-center gap-2"
        >
            <span>{projectName}</span>
            <ChevronRight className="w-3 h-3 text-gray-600" />
        </div>
      </div>
      
      {/* File List Actions */}
      <div className="px-4 pt-3 flex items-center justify-between">
         <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Files
        </span>
        <div className="flex gap-1">
            <button 
                onClick={(e) => handleStartCreate(e, '', 'file')}
                className="p-1 hover:bg-gray-800 text-gray-500 hover:text-gray-300 rounded"
                title="New File (Root)"
            >
                <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button 
                onClick={(e) => handleStartCreate(e, '', 'folder')}
                className="p-1 hover:bg-gray-800 text-gray-500 hover:text-gray-300 rounded"
                title="New Folder (Root)"
            >
                <FolderPlus className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      {/* File List */}
      <div 
        className={`flex-1 overflow-y-auto py-2 custom-scrollbar transition-colors ${
            dragOverId === 'ROOT_CONTAINER' ? 'bg-indigo-900/10' : ''
        }`}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {creationState?.parentPath === '' && <CreationInput depth={0} />}
        {fileTree.map(node => renderNode(node, 0))}
        
        {/* Empty state or fill remaining area to ensure easy root drop */}
        <div className="h-20" />
      </div>
    </div>
  );
};

const FileIcon = ({ name }: { name: string }) => {
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className="w-3.5 h-3.5" />;
  if (name.endsWith('.json')) return <FileJson className="w-3.5 h-3.5" />;
  return <FileType className="w-3.5 h-3.5" />;
};

export default FileExplorer;
