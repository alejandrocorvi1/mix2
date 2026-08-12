import React from 'react';
import { AlertTriangle, Key, X, ArrowRight } from 'lucide-react';
import { getPatTokenStatus } from '../supabaseClient';

interface PatRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfig: () => void;
}

export const PatRenewalModal: React.FC<PatRenewalModalProps> = ({
  isOpen,
  onClose,
  onOpenConfig,
}) => {
  if (!isOpen) return null;

  const { elapsedDays, daysUntilWarning, totalDaysRemaining } = getPatTokenStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-amber-500/10 text-slate-100 relative">
        
        {/* Close Button (Dismiss for current session) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar por esta sesión"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
          <AlertTriangle className="w-7 h-7" />
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
            Aviso de Expiración Próxima
          </span>
          <h2 className="text-xl font-extrabold text-white">
            Renovar el SUPABASE MANAGEMENT TOKEN
          </h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Han transcurrido <strong className="text-amber-300 font-mono">{elapsedDays} días</strong> desde que se creó el Personal Access Token (PAT) de Supabase. Te quedan <strong className="text-amber-300 font-mono">{totalDaysRemaining} días</strong> de vigencia oficial.
          </p>
        </div>

        {/* Info Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-start gap-2">
            <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">¿Por qué ves esta alerta?</p>
              <p className="text-slate-400 mt-0.5">
                Se ha alcanzado el umbral de <strong>350 días</strong>. Para evitar la pérdida de conectividad en la lectura de métricas de la app, genera un nuevo token en tu panel de Supabase y actualízalo.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-amber-400/90 font-medium italic border-t border-slate-800/80 pt-2">
            * Este cartel reaparecerá cada vez que abras la app hasta que reemplaces el token en la configuración.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenConfig();
            }}
            className="flex-1 py-3 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            <span>Reemplazar Token Ahora</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={onClose}
            className="py-3 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition text-center"
          >
            Cerrar por esta sesión
          </button>
        </div>

      </div>
    </div>
  );
};
