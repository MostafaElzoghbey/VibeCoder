import React from 'react';
import { Project } from '../types';
import { Plus, Trash2, MessageSquare, Clock, Layout } from 'lucide-react';

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject
}) => {
  // Sort projects by last modified
  const sortedProjects = [...projects].sort((a, b) => b.lastModified - a.lastModified);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xl mb-4">
              <Layout className="w-6 h-6" />
              <span>VibeCoder</span>
            </div>
            <button
              onClick={() => {
                  onCreateProject();
                  onClose();
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <h3 className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent Projects
            </h3>
            
            {sortedProjects.map(project => (
              <div
                key={project.id}
                onClick={() => {
                  onSelectProject(project.id);
                  onClose();
                }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  activeProjectId === project.id
                    ? 'bg-gray-800 border border-gray-700'
                    : 'hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1 mr-2">
                  <span className={`text-sm font-medium truncate ${
                    activeProjectId === project.id ? 'text-white' : 'text-gray-300'
                  }`}>
                    {project.name}
                  </span>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.lastModified).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {project.messages.length}
                    </span>
                  </div>
                </div>

                {/* Delete Button (prevent selecting project when clicking delete) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm('Are you sure you want to delete this project?')) {
                        onDeleteProject(project.id);
                    }
                  }}
                  className={`p-1.5 rounded-md text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ${
                    activeProjectId === project.id ? 'opacity-100' : ''
                  }`}
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 text-xs text-center text-gray-600">
            VibeCoder v1.0
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectSidebar;
