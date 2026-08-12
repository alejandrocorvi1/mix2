import React, { useState, useEffect } from 'react';
import { DownloadPage } from './components/DownloadPage';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { InstructionsModal } from './components/InstructionsModal';
import { PatRenewalModal } from './components/PatRenewalModal';
import { InitialScreen } from './components/TwinLink/InitialScreen';
import { SharedPanel } from './components/TwinLink/SharedPanel';
import { normalizeRoomCode } from './lib/device';
import { initSupabaseFirestoreSync, getPatTokenStatus } from './supabaseClient';
import { Settings } from 'lucide-react';

export default function App() {
  // Direct Download Page state (if opening legacy file URL)
  const [downloadTarget, setDownloadTarget] = useState<{ filePath: string; fileName: string } | null>(null);

  // TwinLink Real-time Room States
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [initialUrlCode, setInitialUrlCode] = useState<string>('');

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isPatModalDismissedSession, setIsPatModalDismissedSession] = useState(false);

  // PAT Expiration status check
  const patStatus = getPatTokenStatus();
  const isPatModalOpen = patStatus.isWarningRequired && !isPatModalDismissedSession;

  // Initialize Supabase credentials sync with Firestore & Detect URL Params on Load
  useEffect(() => {
    initSupabaseFirestoreSync();

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
      
      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center">
        
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

      <PatRenewalModal
        isOpen={isPatModalOpen}
        onClose={() => setIsPatModalDismissedSession(true)}
        onOpenConfig={() => setIsConfigModalOpen(true)}
      />

    </div>
  );
}
