import React, { useState, useMemo } from 'react';
import { 
  FileCode, FileJson, FileType, Folder, FolderOpen, 
  ChevronRight, ChevronDown, Trash2, Plus 
} from 'lucide-react';
import { File } from '../types';

interface FileExplorerProps {
  files: File[];
  activeFile: string;
  onFileSelect: (fileName: string) => void;
  onFileDelete: (fileName: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  activeFile, 
  onFileSelect,
  onFileDelete
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['components', 'components/ui']));

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
      const parts = file.name.split('/');
      let currentLevel = root;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
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
    e.stopPropagation();
    if (node.type === 'file') {
       if (window.confirm(`Delete ${node.name}?`)) {
           onFileDelete(node.path);
       }
    } else {
       if (window.confirm(`Delete folder ${node.name} and all its contents?`)) {
           // Find all files starting with this path
           const filesToDelete = files.filter(f => f.name.startsWith(node.path + '/'));
           filesToDelete.forEach(f => onFileDelete(f.name));
       }
    }
  };

  const renderNode = (node: FileNode, depth: number) => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile === node.path;
    
    return (
      <div key={node.path}>
        <div
          onClick={() => node.type === 'folder' ? toggleFolder(node.path) : onFileSelect(node.path)}
          className={`group flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors text-sm border-l-2
            ${isActive 
                ? 'bg-indigo-600/10 text-indigo-300 border-indigo-500' 
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
          
          <span className="truncate flex-1 select-none">{node.name}</span>
          
          {node.name !== 'App.tsx' && (
             <button
                onClick={(e) => handleDelete(e, node)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
                title="Delete"
             >
               <Trash2 className="w-3 h-3" />
             </button>
          )}
        </div>
        
        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800 text-gray-400 select-none">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-200 font-semibold text-sm">
          <FolderOpen className="w-4 h-4" />
          <span>Project</span>
        </div>
        {/* Placeholder for creating new files/folders manually */}
        <button 
          className="p-1 hover:bg-gray-800 rounded transition-colors opacity-50 cursor-not-allowed"
          title="New File (Coming Soon)"
        >
            <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {fileTree.map(node => renderNode(node, 0))}
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
