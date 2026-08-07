import React, { useState, useEffect } from 'react';
import { DownloadPage } from './components/DownloadPage';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { InstructionsModal } from './components/InstructionsModal';
import { InitialScreen } from './components/TwinLink/InitialScreen';
import { SharedPanel } from './components/TwinLink/SharedPanel';
import { normalizeRoomCode } from './lib/device';
import { Settings, Zap, Radio } from 'lucide-react';

export default function App() {
  // Direct Download Page state (if opening legacy file URL)
  const [downloadTarget, setDownloadTarget] = useState<{ filePath: string; fileName: string } | null>(null);

  // TwinLink Real-time Room States
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [initialUrlCode, setInitialUrlCode] = useState<string>('');

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Detect URL Params on Load (e.g., ?code=ABC%20123 or ?file=...&name=...)
  useEffect(() => {
    const handleUrlParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const fileParam = searchParams.get('file');
      const nameParam = searchParams.get('name');
      const codeParam = searchParams.get('code');

      if (codeParam) {
        const normCode = normalizeRoomCode(codeParam);
        setInitialUrlCode(normCode);
        setActiveRoomCode(normCode);
      } else if (fileParam) {
        setDownloadTarget({
          filePath: decodeURIComponent(fileParam),
          fileName: nameParam ? decodeURIComponent(nameParam) : 'archivo_descargado',
        });
      }
    };

    handleUrlParams();
    window.addEventListener('popstate', handleUrlParams);
    return () => window.removeEventListener('popstate', handleUrlParams);
  }, []);

  // TwinLink Handlers
  const handleJoinTwinLinkRoom = (code: string) => {
    const normalized = normalizeRoomCode(code);
    setActiveRoomCode(normalized);
    setDownloadTarget(null);

    // Update URL parameter
    const newUrl = `${window.location.pathname}?code=${encodeURIComponent(normalized)}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleExitTwinLinkRoom = () => {
    setActiveRoomCode(null);
    setInitialUrlCode('');
    setDownloadTarget(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleBackToUpload = () => {
    setDownloadTarget(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo / Title */}
          <div 
            onClick={handleExitTwinLinkRoom}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Twin<span className="text-cyan-400">Link</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-mono -mt-1">
                Sala Compartida en Tiempo Real
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {activeRoomCode && (
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl">
                <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                <span>Sala {activeRoomCode}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        
        {downloadTarget ? (
          /* Vista de Descarga Directa desde Enlace */
          <DownloadPage
            filePath={downloadTarget.filePath}
            fileName={downloadTarget.fileName}
            onBackToUpload={handleBackToUpload}
          />
        ) : activeRoomCode ? (
          /* Vista de la Sala TwinLink (Chat + Archivos Compartidos) */
          <SharedPanel
            roomCode={activeRoomCode}
            onExit={handleExitTwinLinkRoom}
            onOpenHelp={() => setIsHelpModalOpen(true)}
          />
        ) : (
          /* Pantalla Inicial de Inicio de Sesión / Generación de Sala */
          <InitialScreen
            onJoinRoom={handleJoinTwinLinkRoom}
            initialCode={initialUrlCode}
          />
        )}

      </main>

      {/* Footer with sleek credentials button */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/90 py-3.5 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-center">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 text-xs font-medium text-slate-400 hover:text-slate-100 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/90 hover:border-slate-700/80 rounded-xl transition-all shadow-sm active:scale-[0.99]"
            title="Configurar credenciales de Supabase"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>Configurar Credenciales de Supabase</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={() => {}}
      />

      <InstructionsModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

    </div>
  );
}
