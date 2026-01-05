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
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.min.js"></script>
        <style>
          body { background-color: white; margin: 0; font-family: sans-serif; }
          #root { min-height: 100vh; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script>
          // Pass the files data into the iframe
          window.files = ${JSON.stringify(codeFiles).replace(/<\/script>/g, '<\\/script>')};
          
          window.modules = {};
          
          // Path resolution helper
          function resolvePath(base, relative) {
             const stack = base.split('/');
             stack.pop(); // Remove current filename from base
             
             const parts = relative.split('/');
             for (let i = 0; i < parts.length; i++) {
               if (parts[i] === '.') continue;
               if (parts[i] === '..') stack.pop();
               else stack.push(parts[i]);
             }
             return stack.join('/');
          }

          // Custom require function
          function requireModule(path, currentFile) {
             // Handle external deps
             if (path === 'react') return React;
             if (path === 'react-dom') return ReactDOM;
             if (path === 'lucide-react') return window.lucideReact;
             
             // Resolve path
             let resolvedPath;
             if (path.startsWith('./') || path.startsWith('../')) {
                resolvedPath = resolvePath(currentFile, path);
             } else {
                resolvedPath = path.replace(/^[./]+/, '');
             }
             
             // Try to find module with various extensions
             const extensions = ['', '.tsx', '.ts', '.js', '.jsx'];
             let key = null;
             
             // First check exact match
             if (window.modules[resolvedPath]) {
                 key = resolvedPath;
             } else {
                 // Check extensions
                 for (const ext of extensions) {
                     const tryKey = resolvedPath + ext;
                     if (window.modules[tryKey]) {
                         key = tryKey;
                         break;
                     }
                 }
             }

             if (key) {
                 const mod = window.modules[key];
                 if (!mod.initialized) {
                     // Execute the module function
                     const contextRequire = (p) => requireModule(p, key);
                     mod.fn(mod.exports, contextRequire, mod);
                     mod.initialized = true;
                 }
                 return mod.exports;
             }
             
             throw new Error('Cannot find module: ' + path + ' (requested from ' + currentFile + ')');
          }

          // Main compilation and execution logic
          function compileAndRun() {
            try {
                if (!window.Babel) {
                    throw new Error('Babel not loaded');
                }

                // 1. Register all files
                window.files.forEach(file => {
                    // Transpile code to CommonJS using Babel
                    // This converts 'import' to 'require'
                    const result = Babel.transform(file.content, {
                        presets: ['react', ['env', { modules: 'commonjs' }]],
                        filename: file.name
                    });
                    
                    // Wrap in a function to create module scope
                    // new Function('exports', 'require', 'module', code)
                    const fn = new Function('exports', 'require', 'module', result.code);
                    
                    window.modules[file.name] = {
                        exports: {},
                        fn: fn,
                        initialized: false
                    };
                });
                
                // 2. Mount App
                // We use our custom require to load App.tsx. 
                // We pass 'root' as currentFile context.
                const AppExports = requireModule('./App', 'root');
                const App = AppExports.default;
                
                if (!App) throw new Error('App.tsx does not have a default export');

                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(React.createElement(App));
                
            } catch (err) {
                const root = document.getElementById('root');
                root.innerHTML = '<div style="color:red; padding: 20px; background: #fff0f0; border: 1px solid #ffcccc; margin: 20px; border-radius: 8px;">' +
                    '<h3 style="margin-top:0">Preview Error</h3>' + 
                    '<pre style="white-space: pre-wrap;">' + err.toString() + '</pre>' + 
                    '</div>';
                console.error('Preview Error:', err);
            }
          }
          
          // Start when DOM is ready
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
