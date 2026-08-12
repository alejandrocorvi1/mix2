import React, { useState } from 'react';
import { BarChart3, Loader2, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import { fetchSupabaseEgressUsage } from '../supabaseClient';

interface EgressUsageBadgeProps {
  projectRef?: string;
  managementToken?: string;
}

export const EgressUsageBadge: React.FC<EgressUsageBadgeProps> = ({
  projectRef,
  managementToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{
    percentage: number;
    usedGb: number;
    totalGb: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchUsage = async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSupabaseEgressUsage(projectRef, managementToken);

    if (result.success && typeof result.percentage === 'number') {
      setUsage({
        percentage: result.percentage,
        usedGb: result.usedGb ?? 0,
        totalGb: result.totalGb ?? 5.0,
      });
    } else {
      setError(result.error || 'No se pudo obtener las métricas de uso de Supabase.');
    }

    setLoading(false);
  };

  // Determinar colores según porcentaje
  const getBadgeColors = (percentage: number) => {
    if (percentage > 90) {
      return {
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        text: 'text-red-400',
        bar: 'bg-red-500',
      };
    }
    if (percentage > 70) {
      return {
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40',
        text: 'text-amber-400',
        bar: 'bg-amber-500',
      };
    }
    return {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/40',
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
    };
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 mt-2.5 w-full">
      {/* Botón a demanda */}
      <button
        type="button"
        onClick={handleFetchUsage}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-cyan-400 hover:text-cyan-300 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Consultando métricas de Egress...</span>
          </>
        ) : (
          <>
            {usage ? <RefreshCw className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
            <span>{usage ? 'Actualizar Egress Supabase' : 'Consultar % de Egress Consumido'}</span>
          </>
        )}
      </button>

      {/* Error si ocurre */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg max-w-sm text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Badge con Resultado */}
      {usage && (
        <div className="w-full max-w-xs flex flex-col items-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner animate-fadeIn">
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-cyan-400" />
              Ancho de banda (Egress)
            </span>
            {(() => {
              const colors = getBadgeColors(usage.percentage);
              return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.border} ${colors.text} border`}>
                  {usage.percentage.toFixed(1)}%
                </span>
              );
            })()}
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full transition-all duration-500 ${getBadgeColors(usage.percentage).bar}`}
              style={{ width: `${Math.min(100, Math.max(2, usage.percentage))}%` }}
            />
          </div>

          {/* Detalle en GB */}
          <p className="text-[11px] font-mono text-slate-400 text-center">
            Consumo actual: <strong className="text-slate-200">{usage.usedGb.toFixed(2)} GB</strong> de <strong className="text-slate-200">{usage.totalGb.toFixed(2)} GB</strong> disponibles
          </p>
        </div>
      )}
    </div>
  );
};
