import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowModal(true);
    } else {
      setShowModal(true);
    }
  };

  if (isStandalone || isInstalled) {
    return null; // Already installed or open in standalone mode
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded-xl transition-all shadow-sm active:scale-95"
        title="Instalar TwinLink en tu dispositivo"
      >
        <Smartphone className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>Instalar App</span>
      </button>

      {/* PWA Info / iOS Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative animate-fadeIn">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-cyan-500/30 flex items-center justify-center overflow-hidden p-1 shadow-md shadow-cyan-500/20">
                <img src="/pwa-icon.jpg" alt="TwinLink App Icon" className="w-full h-full object-cover rounded-xl" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Instalar TwinLink</h3>
                <p className="text-xs text-cyan-400">PWA Móvil y Escritorio</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="font-medium text-slate-200">Para instalar en tu iPhone o iPad:</p>
                <ol className="space-y-2.5 list-decimal list-inside bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <li className="leading-relaxed">
                    Toca el botón <span className="font-semibold text-cyan-400 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Compartir</span> en la barra de Safari.
                  </li>
                  <li className="leading-relaxed">
                    Desplázate hacia abajo y selecciona <span className="font-semibold text-white">"Añadir a la pantalla de inicio"</span>.
                  </li>
                  <li className="leading-relaxed">
                    Toca <span className="font-semibold text-cyan-400">Añadir</span> en la esquina superior derecha.
                  </li>
                </ol>
                <p className="text-[11px] text-slate-400 text-center pt-1">
                  ¡El icono cubrirá el 100% de la cuadrícula de tu pantalla!
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="leading-relaxed">
                  Para instalar la aplicación con su icono adaptable en tu teléfono o PC, usa el menú del navegador:
                </p>
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Abre los 3 puntos del navegador en la parte superior.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-cyan-500/20 transition-all active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
