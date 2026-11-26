import React, { useMemo } from 'react';
import { File } from '../types';

interface PreviewFrameProps {
  files: File[];
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ files }) => {
  const srcDoc = useMemo(() => {
    const codeFiles = files
      .filter(f =>
        f.name.endsWith('.tsx') ||
        f.name.endsWith('.ts') ||
        f.name.endsWith('.js') ||
        f.name.endsWith('.jsx')
      )
      .map(f => ({
        ...f,
        name: f.name.replace(/^[./]+/, '')
      }));

    const cssContent = files
      .filter(f => f.name.endsWith('.css'))
      .map(f => f.content)
      .join('\n');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script>
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
          ${cssContent.replace(/<\/style>/gi, '<\\/style>')}
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
          import React from "https://esm.sh/react@18.3.1?dev";
          import * as ReactJSXRuntime from "https://esm.sh/react@18.3.1/jsx-runtime?dev&deps=react@18.3.1";
          import * as ReactJSXDevRuntime from "https://esm.sh/react@18.3.1/jsx-dev-runtime?dev&deps=react@18.3.1";
          import ReactDOM from "https://esm.sh/react-dom@18.3.1?dev&deps=react@18.3.1";
          import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?dev&deps=react@18.3.1";
          import * as LucideReact from "https://esm.sh/lucide-react@0.469.0?dev&deps=react@18.3.1";
          import { clsx } from "https://esm.sh/clsx@2.1.1?dev";
          import { twMerge } from "https://esm.sh/tailwind-merge@2.6.0?dev";
          import * as HeadlessUI from "https://esm.sh/@headlessui/react@2.2.0?dev&deps=react@18.3.1,react-dom@18.3.1";

          const jsxRuntime = { ...ReactJSXRuntime, ...(ReactJSXRuntime.default || {}), __esModule: true };
          const jsxDevRuntime = { ...ReactJSXDevRuntime, ...(ReactJSXDevRuntime.default || {}), __esModule: true };

          window.__deps = {
            'react': { ...React, default: React, __esModule: true },
            'react/jsx-runtime': jsxRuntime,
            'react/jsx-dev-runtime': jsxDevRuntime,
            'react-dom': { ...ReactDOM, default: ReactDOM, __esModule: true },
            'react-dom/client': { createRoot, default: { createRoot }, __esModule: true },
            'lucide-react': LucideReact,
            'clsx': { default: clsx, clsx, __esModule: true },
            'tailwind-merge': { default: twMerge, twMerge, __esModule: true },
            '@headlessui/react': HeadlessUI
          };
        </script>

        <script>
          window.files = ${JSON.stringify(codeFiles).replace(/<\/script>/g, '<\\/script>')};
          window.modules = {};

          function resolvePath(base, relative) {
             const stack = base.split('/');
             stack.pop();

             const parts = relative.split('/');
             for (let i = 0; i < parts.length; i++) {
               if (parts[i] === '.' || parts[i] === '') continue;
               if (parts[i] === '..') stack.pop();
               else stack.push(parts[i]);
             }
             return stack.join('/');
          }

          function requireModule(path, currentFile) {
             if (window.__deps && window.__deps[path]) return window.__deps[path];
             if (path.endsWith('.css')) return {};

             let resolvedPath;
             if (path.startsWith('./') || path.startsWith('../')) {
                resolvedPath = resolvePath(currentFile, path);
             } else if (path.startsWith('@/')) {
                resolvedPath = path.slice(2);
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
                     const React = window.__deps['react'].default;

                     mod.initialized = true;
                     mod.fn(mod.exports, contextRequire, mod, process, React);
                 }
                 return mod.exports;
             }

             throw new Error('Cannot find module: ' + path + ' (requested from ' + currentFile + ')');
          }

          let attempt = 0;
          function compileAndRun() {
            if (!window.Babel || !window.__deps) {
                attempt++;
                if (attempt > 50) {
                    const root = document.getElementById('root');
                    root.innerHTML = '<div class="error-container">Timeout loading dependencies. Network may be slow.</div>';
                    return;
                }
                setTimeout(compileAndRun, 100);
                return;
            }

            try {
                const React = window.__deps['react'].default;

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

                window.files.forEach(file => {
                    let result;
                    try {
                        result = Babel.transform(file.content, {
                            presets: [
                                ['react', { runtime: 'automatic' }],
                                'typescript',
                                ['env', { modules: 'commonjs' }]
                            ],
                            filename: file.name
                        });
                    } catch (compileErr) {
                        throw new Error('Syntax error in ' + file.name + ': ' + compileErr.message);
                    }
                    const fn = new Function('exports', 'require', 'module', 'process', 'React', result.code);

                    window.modules[file.name] = {
                        exports: {},
                        fn: fn,
                        initialized: false
                    };
                });

                let AppExports;
                try {
                    AppExports = requireModule('./App', 'root');
                } catch (e) {
                    if (window.modules['src/App.tsx'] || window.modules['src/App.jsx']) {
                        AppExports = requireModule('./src/App', 'root');
                    } else {
                        throw e;
                    }
                }

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
  }, [files]);

  return (
    <iframe
      srcDoc={srcDoc}
      title="Preview"
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-modals"
    />
  );
};

export default PreviewFrame;
