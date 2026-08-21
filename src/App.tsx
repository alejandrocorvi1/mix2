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

const LAST_FOCUSED_ROOM_KEY = 'twinlink_last_focused_room';
const WINDOW_ID_KEY = 'twinlink_window_id';

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

  // Initialize Supabase credentials sync, detect URL params and remember the last focused room.
  useEffect(() => {
    initSupabaseFirestoreSync();

    let windowId = '';
    try {
      windowId = sessionStorage.getItem(WINDOW_ID_KEY) || '';
      if (!windowId) {
        windowId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(WINDOW_ID_KEY, windowId);
      }
    } catch {}

    const rememberFocusedRoom = () => {
      try {
        const currentRoom = localStorage.getItem('twinlink_active_room');
        if (!currentRoom) return;
        localStorage.setItem(
          LAST_FOCUSED_ROOM_KEY,
          JSON.stringify({ roomCode: currentRoom, windowId, timestamp: Date.now() })
        );
      } catch {}
    };

    const handleUrlParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const fileParam = searchParams.get('file');
      const nameParam = searchParams.get('name');
      const codeParam = searchParams.get('code');
      const sharedParam = searchParams.get('shared');

      if (codeParam) {
        const normCode = normalizeRoomCode(codeParam);
        setInitialUrlCode(normCode);
        setActiveRoomCode(normCode);
      } else if (sharedParam === 'true') {
        // Web Share Target opens a new context. The browser does not expose the
        // originating window, so use the room most recently focused by a TwinLink window.
        try {
          const raw = localStorage.getItem(LAST_FOCUSED_ROOM_KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved?.roomCode) {
              const normCode = normalizeRoomCode(saved.roomCode);
              setInitialUrlCode(normCode);
              setActiveRoomCode(normCode);
            }
          }
        } catch {}
      } else if (fileParam) {
        setDownloadTarget({
          filePath: decodeURIComponent(fileParam),
          fileName: nameParam ? decodeURIComponent(nameParam) : 'archivo_descargado',
        });
      }
    };

    handleUrlParams();
    rememberFocusedRoom();

    window.addEventListener('focus', rememberFocusedRoom);
    document.addEventListener('visibilitychange', rememberFocusedRoom);
    window.addEventListener('popstate', handleUrlParams);

    return () => {
      window.removeEventListener('focus', rememberFocusedRoom);
      document.removeEventListener('visibilitychange', rememberFocusedRoom);
      window.removeEventListener('popstate', handleUrlParams);
    };
  }, []);

  // Keep the last focused room updated whenever the active room changes.
  useEffect(() => {
    if (!activeRoomCode) return;
    try {
      let windowId = sessionStorage.getItem(WINDOW_ID_KEY) || '';
      if (!windowId) {
        windowId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(WINDOW_ID_KEY, windowId);
      }
      localStorage.setItem(
        'twinlink_active_room',
        normalizeRoomCode(activeRoomCode)
      );
      localStorage.setItem(
        LAST_FOCUSED_ROOM_KEY,
        JSON.stringify({ roomCode: normalizeRoomCode(activeRoomCode), windowId, timestamp: Date.now() })
      );
    } catch {}
  }, [activeRoomCode]);

  // TwinLink Handlers
  const handleJoinTwinLinkRoom = (code: string) => {
    const normalized = normalizeRoomCode(code);
    setActiveRoomCode(normalized);
    setDownloadTarget(null);
    try {
      localStorage.setItem('twinlink_active_room', normalized);
      let windowId = sessionStorage.getItem(WINDOW_ID_KEY) || '';
      if (!windowId) {
        windowId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(WINDOW_ID_KEY, windowId);
      }
      localStorage.setItem(
        LAST_FOCUSED_ROOM_KEY,
        JSON.stringify({ roomCode: normalized, windowId, timestamp: Date.now() })
      );
    } catch {}

    // Update URL parameter
    const newUrl = `${window.location.pathname}?code=${encodeURIComponent(normalized)}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleExitTwinLinkRoom = () => {
    setActiveRoomCode(null);
    setInitialUrlCode('');
    setDownloadTarget(null);
    try {
      localStorage.removeItem('twinlink_active_room');
      const raw = localStorage.getItem(LAST_FOCUSED_ROOM_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.windowId) {
        localStorage.removeItem(LAST_FOCUSED_ROOM_KEY);
      }
    } catch {}
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
