import React from 'react';
import { FileCode, FileJson, FileType, FolderOpen, Plus } from 'lucide-react';
import { File } from '../types';

interface FileExplorerProps {
  files: File[];
  activeFile: string;
  onFileSelect: (fileName: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  activeFile, 
  onFileSelect 
}) => {
  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800 text-gray-400">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-200 font-semibold text-sm">
          <FolderOpen className="w-4 h-4" />
          <span>Project</span>
        </div>
        <button 
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title="New File (Coming Soon)"
        >
            <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2">
            <div className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                Files
            </div>
            <div className="space-y-0.5">
                {files.map((file) => (
                <button
                    key={file.name}
                    onClick={() => onFileSelect(file.name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    activeFile === file.name
                        ? 'bg-indigo-600/10 text-indigo-400'
                        : 'hover:bg-gray-900 text-gray-400 hover:text-gray-300'
                    }`}
                >
                    <FileIcon name={file.name} />
                    <span className="truncate">{file.name}</span>
                </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

const FileIcon = ({ name }: { name: string }) => {
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className="w-4 h-4" />;
  if (name.endsWith('.json')) return <FileJson className="w-4 h-4" />;
  return <FileType className="w-4 h-4" />;
};

export default FileExplorer;
