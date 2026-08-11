import React, { useState, useEffect } from 'react';
import { X, Key, Globe, CheckCircle2, AlertTriangle, RefreshCw, Copy, Check, Lock, ShieldCheck, ArrowRight, Eye, EyeOff, Cloud, Loader2 } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getActiveCredentials, resetSupabaseClient, updateGlobalCredentials } from '../supabaseClient';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const REQUIRED_ADMIN_PASSWORD = "Supabase123@";

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const current = getActiveCredentials();

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [urlInput, setUrlInput] = useState(
    localStorage.getItem('TEMPFILES_SUPABASE_URL') || ''
  );
  const [keyInput, setKeyInput] = useState(
    localStorage.getItem('TEMPFILES_SUPABASE_ANON_KEY') || ''
  );
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync inputs with active credentials when opening
  useEffect(() => {
    if (isOpen) {
      const active = getActiveCredentials();
      if (active.isConfigured) {
        setUrlInput(active.url);
        setKeyInput(active.anonKey);
      }
    } else {
      setPasswordInput('');
      setPasswordError(null);
      setIsAuthenticated(false);
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(null);
    } else {
      setPasswordError('Contraseña incorrecta. Por favor verifique e intente de nuevo.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanUrl = urlInput.trim();
    const cleanKey = keyInput.trim();

    if (cleanUrl && cleanKey) {
      updateGlobalCredentials(cleanUrl, cleanKey);
    } else {
      updateGlobalCredentials(null, null);
    }

    setIsSaving(false);
    onSaved();
    onClose();
  };

  const handleResetToPlaceholders = async () => {
    setIsSaving(true);
    updateGlobalCredentials(null, null);
    setUrlInput('');
    setKeyInput('');
    setIsSaving(false);
    onSaved();
  };

  const copyCodeSnippet = () => {
    const code = `export const SUPABASE_URL = "${SUPABASE_URL}";\nexport const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: PASSWORD AUTHENTICATION SCREEN */}
        {!isAuthenticated ? (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/10">
              <Lock className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">Acceso Protegido</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Ingresa la clave de administración para acceder a la configuración de credenciales de Supabase.
              </p>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4 max-w-sm mx-auto">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese la clave..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium text-center">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-slate-950 rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Acceder
                </button>
              </div>

              <div className="pt-3 text-center">
                <p className="text-xs text-slate-400/80 font-mono tracking-wide select-none">
                  Generado en GAIS cuenta AC2
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* STEP 2: CREDENTIAL CONFIGURATION FORM */
          <div className="animate-fadeIn">
            {/* Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Configuración de Supabase</h2>
                <p className="text-xs text-slate-400">
                  Variables globales <code className="text-orange-300 font-mono">SUPABASE_URL</code> y <code className="text-orange-300 font-mono">SUPABASE_ANON_KEY</code>
                </p>
              </div>
            </div>

            {/* Requisito 4 Highlight */}
            <div className="mb-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-xs text-slate-300 relative group">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  Código Fuente (src/supabaseClient.ts)
                </span>
                <button
                  onClick={copyCodeSnippet}
                  className="text-slate-400 hover:text-orange-300 text-xs flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-700"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="text-orange-300 overflow-x-auto whitespace-pre p-2 bg-slate-950 rounded border border-slate-800">
{`export const SUPABASE_URL = "${SUPABASE_URL}";
export const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";`}
              </pre>
            </div>

            {/* Current Connection Status */}
            <div className={`p-4 rounded-xl mb-6 border ${
              current.isConfigured
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-start gap-3">
                {current.isConfigured ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-semibold text-sm">
                    {current.isConfigured
                      ? 'Conectado a tu proyecto de Supabase'
                      : 'Modo Placeholder Activo (Simulación para pruebas)'}
                  </h4>
                  <p className="text-xs mt-1 text-slate-300 opacity-90">
                    {current.isConfigured
                      ? `Subiendo directamente al bucket 'temp-files' en ${current.url}`
                      : 'Puedes probar toda la interfaz y el flujo de subida/descarga/autodestrucción inmediatamente. Para conectar un proyecto real de Supabase, ingresa tus claves a continuación.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-orange-400" />
                  SUPABASE_URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-orange-400" />
                  SUPABASE_ANON_KEY
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition font-mono"
                />
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  Las credenciales que guardes aquí se almacenan en <strong>Firestore</strong> para que la app publicada mantenga tu proyecto de Supabase activo permanentemente para todos tus usuarios.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleResetToPlaceholders}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 py-2 px-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restablecer Placeholders
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-slate-950 rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Guardando en Firestore...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5" />
                        Guardar Credenciales
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
