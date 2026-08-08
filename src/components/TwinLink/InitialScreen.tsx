import React, { useState, useEffect } from 'react';
import {
  Zap,
  ArrowRight,
  Plus,
  History,
  Trash2,
  Lock,
  Smartphone,
  Globe,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  generateRoomCode,
  normalizeRoomCode,
  getRecentCodes,
  removeRecentCode,
  clearRecentCodes,
} from '../../lib/device';

interface InitialScreenProps {
  onJoinRoom: (code: string) => void;
  initialCode?: string;
}

export const InitialScreen: React.FC<InitialScreenProps> = ({
  onJoinRoom,
  initialCode = '',
}) => {
  const [inputCode, setInputCode] = useState(normalizeRoomCode(initialCode));
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setRecentCodes(getRecentCodes());
  }, []);

  useEffect(() => {
    if (initialCode) {
      const norm = normalizeRoomCode(initialCode);
      setInputCode(norm);
    }
  }, [initialCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const raw = e.target.value;
    const formatted = normalizeRoomCode(raw);
    setInputCode(formatted);
  };

  const handleJoin = (codeToJoin?: string) => {
    const target = codeToJoin || inputCode;
    const norm = normalizeRoomCode(target);

    // Validate code length (3 chars + space + 3 chars = 7 length)
    if (!norm || norm.length < 7) {
      setErrorMsg('Ingresa un código válido de 6 caracteres (Ej: ABC 123)');
      return;
    }

    setErrorMsg(null);
    onJoinRoom(norm);
  };

  const handleGenerateNew = () => {
    const newCode = generateRoomCode();
    setInputCode(newCode);
    onJoinRoom(newCode);
  };

  const handleRemoveRecent = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentCode(code);
    setRecentCodes(getRecentCodes());
  };

  const handleClearHistory = () => {
    clearRecentCodes();
    setRecentCodes([]);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-fadeIn">
      {/* Header Branding */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Twin<span className="text-cyan-400">Link</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Conecta tus dispositivos al instante con un código único sin registros ni descargas.
        </p>
      </div>

      {/* Main Join / Create Card */}
      <div className="bg-[#0b101d] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-950/80 space-y-6">
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">
            Código de Sala
          </label>

          {/* 6-digit Code Input */}
          <div className="relative">
            <input
              type="text"
              value={inputCode}
              onChange={handleCodeChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoin();
              }}
              placeholder="123  456"
              maxLength={7}
              className="w-full bg-slate-950/90 border-2 border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-widest text-cyan-400 placeholder:text-slate-700 focus:outline-none transition-colors uppercase shadow-inner"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 text-center font-medium animate-shake">
              {errorMsg}
            </p>
          )}

          {/* Action Button: Join */}
          <button
            onClick={() => handleJoin()}
            disabled={!inputCode || inputCode.length < 7}
            className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
          >
            <span>Unirse con Código</span>
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-[#0b101d] px-3 text-xs text-slate-500 uppercase font-mono">
            o
          </span>
        </div>

        {/* Action Button: Generate New */}
        <button
          onClick={handleGenerateNew}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generar Nuevo Código</span>
        </button>
      </div>

      {/* Recent Rooms List */}
      {recentCodes.length > 0 && (
        <div className="bg-[#0b101d]/80 border border-slate-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Salas Recientes</span>
            </div>
            <button
              onClick={handleClearHistory}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
            >
              Borrar historial
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentCodes.map((code) => (
              <div
                key={code}
                onClick={() => handleJoin(code)}
                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl cursor-pointer transition-all group"
              >
                <span className="font-mono font-bold text-sm text-cyan-400 group-hover:text-cyan-300">
                  {code}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                    Reunirse
                  </span>
                  <button
                    onClick={(e) => handleRemoveRecent(code, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    title="Eliminar de recientes"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Card: ¿Cómo funciona TwinLink? */}
      <div className="bg-[#0b101d]/60 border border-slate-800/60 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          ¿Cómo funciona TwinLink?
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Genera o ingresa un código de 6 dígitos en dos o más dispositivos para vincularlos en tiempo real. Comparte notas, textos, enlaces e ideas de forma instantánea sin necesidad de registros ni cuentas externas.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400">
          <div className="flex flex-col items-center text-center gap-1.5 p-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Sincronización directa</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1.5 p-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Sin login</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1.5 p-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>Multi-dispositivo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
