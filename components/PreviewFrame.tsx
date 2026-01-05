import React, { useEffect, useRef } from 'react';
import { File } from '../types';

interface PreviewFrameProps {
  files: File[];
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ files }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Filter for valid code files
    const codeFiles = files.filter(f => 
      f.name.endsWith('.tsx') || 
      f.name.endsWith('.ts') || 
      f.name.endsWith('.js') || 
      f.name.endsWith('.jsx')
    );

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script>
            // 1. Shim process/error handling immediately
            window.process = { env: { NODE_ENV: 'development' } };
            
            window.onerror = function(msg, url, line, col, error) {
                const root = document.getElementById('root');
                if (root) {
                    root.innerHTML = '<div class="error-container">' +
                        '<h3 style="margin-top:0">Runtime Error</h3>' + 
                        '<pre style="white-space: pre-wrap;">' + (error ? error.message : msg) + '</pre>' + 
                        '</div>';
                }
                console.error('Preview Error:', error || msg);
                return false;
            };

            window.addEventListener('unhandledrejection', function(event) {
                 const root = document.getElementById('root');
                 if (root) {
                     root.innerHTML = '<div class="error-container">' +
                        '<h3 style="margin-top:0">Async Error</h3>' + 
                        '<pre style="white-space: pre-wrap;">' + event.reason + '</pre>' + 
                        '</div>';
                 }
                 console.error('Unhandled Rejection:', event.reason);
            });
        </script>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
          body { background-color: white; margin: 0; font-family: sans-serif; }
          #root { min-height: 100vh; }
          .error-container { color: #ef4444; padding: 20px; background: #fef2f2; border: 1px solid #fee2e2; margin: 20px; border-radius: 8px; font-family: monospace; font-size: 14px; }
          .loading { display: flex; justify-content: center; align-items: center; height: 100vh; color: #9ca3af; font-family: sans-serif; gap: 8px; }
          .spinner { width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top-color: #9ca3af; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div id="root">
            <div class="loading">
                <div class="spinner"></div>
                Building...
            </div>
        </div>
        
        <script type="module">
          // Import dependencies from esm.sh with pinned versions to prevent multi-react issues
          import React from "https://esm.sh/react@18.3.1?dev";
          import ReactDOM from "https://esm.sh/react-dom@18.3.1?dev&deps=react@18.3.1";
          import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?dev&deps=react@18.3.1";
          import * as LucideReact from "https://esm.sh/lucide-react@0.469.0?dev&deps=react@18.3.1";
          import { clsx } from "https://esm.sh/clsx@2.1.1?dev";
          import { twMerge } from "https://esm.sh/tailwind-merge@2.6.0?dev";
          import * as HeadlessUI from "https://esm.sh/@headlessui/react@2.2.0?dev&deps=react@18.3.1,react-dom@18.3.1";

          window.__deps = {
            'react': React,
            'react-dom': { ...ReactDOM, default: ReactDOM },
            'react-dom/client': { createRoot },
            'lucide-react': LucideReact,
            'clsx': { default: clsx, clsx },
            'tailwind-merge': { default: twMerge, twMerge },
            '@headlessui/react': HeadlessUI
          };
        </script>

        <script>
          // Pass the files data into the iframe
          window.files = ${JSON.stringify(codeFiles).replace(/<\/script>/g, '<\\/script>')};
          
          window.modules = {};
          
          function resolvePath(base, relative) {
             const stack = base.split('/');
             stack.pop(); 
             
             const parts = relative.split('/');
             for (let i = 0; i < parts.length; i++) {
               if (parts[i] === '.') continue;
               if (parts[i] === '..') stack.pop();
               else stack.push(parts[i]);
             }
             return stack.join('/');
          }

          function requireModule(path, currentFile) {
             if (window.__deps && window.__deps[path]) return window.__deps[path];
             if (path === 'react-dom') return window.__deps['react-dom'];
             
             let resolvedPath;
             if (path.startsWith('./') || path.startsWith('../')) {
                resolvedPath = resolvePath(currentFile, path);
             } else {
                resolvedPath = path.replace(/^[./]+/, '');
             }
             
             const extensions = ['', '.tsx', '.ts', '.js', '.jsx'];
             let key = null;
             
             if (window.modules[resolvedPath]) {
                 key = resolvedPath;
             } else {
                 for (const ext of extensions) {
                     const tryKey = resolvedPath + ext;
                     if (window.modules[tryKey]) {
                         key = tryKey;
                         break;
                     }
                 }
             }
             
             if (!key) {
                 for (const ext of extensions) {
                     const tryKey = resolvedPath + '/index' + ext;
                     if (window.modules[tryKey]) {
                         key = tryKey;
                         break;
                     }
                 }
             }

             if (key) {
                 const mod = window.modules[key];
                 if (!mod.initialized) {
                     const contextRequire = (p) => requireModule(p, key);
                     const process = { env: { NODE_ENV: 'development' } };
                     // Retrieve React from dependencies for the module scope
                     const React = window.__deps['react'];
                     
                     mod.fn(mod.exports, contextRequire, mod, process, React); 
                     mod.initialized = true;
                 }
                 return mod.exports;
             }
             
             throw new Error('Cannot find module: ' + path + ' (requested from ' + currentFile + ')');
          }

          let attempt = 0;
          function compileAndRun() {
            // Wait for both Babel and dependencies
            if (!window.Babel || !window.__deps) {
                attempt++;
                if (attempt > 50) { // 5 seconds timeout
                    const root = document.getElementById('root');
                    root.innerHTML = '<div class="error-container">Timeout loading dependencies. Network may be slow.</div>';
                    return;
                }
                setTimeout(compileAndRun, 100);
                return;
            }

            try {
                const React = window.__deps['react'];
                
                // Define ErrorBoundary inside compileAndRun so it has access to React
                class ErrorBoundary extends React.Component {
                    constructor(props) {
                      super(props);
                      this.state = { hasError: false, error: null };
                    }
                    static getDerivedStateFromError(error) {
                      return { hasError: true, error };
                    }
                    render() {
                      if (this.state.hasError) {
                        return React.createElement('div', { className: 'error-container' },
                          React.createElement('h3', { style: { marginTop: 0 } }, 'Runtime Error'),
                          React.createElement('pre', { style: { whiteSpace: 'pre-wrap' } }, this.state.error.toString())
                        );
                      }
                      return this.props.children;
                    }
                }

                // 1. Register all files
                window.files.forEach(file => {
                    const result = Babel.transform(file.content, {
                        presets: ['react', 'typescript', ['env', { modules: 'commonjs' }]],
                        filename: file.name
                    });
                    // Wrap in a function that accepts exports, require, module, process, React
                    const fn = new Function('exports', 'require', 'module', 'process', 'React', result.code);
                    
                    window.modules[file.name] = {
                        exports: {},
                        fn: fn,
                        initialized: false
                    };
                });
                
                // 2. Mount App
                const AppExports = requireModule('./App', 'root');
                const App = AppExports.default;
                
                if (!App) throw new Error('App.tsx does not have a default export');

                const rootElement = document.getElementById('root');
                const { createRoot } = window.__deps['react-dom/client'];
                
                const root = createRoot(rootElement);
                root.render(
                    React.createElement(ErrorBoundary, null, 
                        React.createElement(App)
                    )
                );
                
            } catch (err) {
                const root = document.getElementById('root');
                root.innerHTML = '<div class="error-container">' +
                    '<h3 style="margin-top:0">Preview Setup Error</h3>' + 
                    '<pre style="white-space: pre-wrap;">' + err.toString() + '</pre>' + 
                    '</div>';
                console.error('Preview Setup Error:', err);
            }
          }
          
          if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', compileAndRun);
          } else {
              compileAndRun();
          }
        </script>
      </body>
      </html>
    `;

    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [files]);

  return (
    <iframe
      ref={iframeRef}
      title="Preview"
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-modals"
    />
  );
};

export default PreviewFrame;
