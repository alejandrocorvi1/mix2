import React from 'react';
import { Flame, Database, Settings, HelpCircle, ShieldCheck, Zap } from 'lucide-react';
import { getActiveCredentials } from '../supabaseClient';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onResetView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHelp,
  onResetView,
}) => {
  const { isConfigured, url } = getActiveCredentials();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo and App Title */}
        <button 
          onClick={onResetView}
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg p-1 text-left transition"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200">
            <Flame className="w-6 h-6 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-orange-400 transition-colors">
                TempDrop
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                1-Use Burn
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Supabase Storage • Auto-elimino con <code className="text-orange-300 font-mono">remove()</code>
            </p>
          </div>
        </button>

        {/* Status Badge & Control Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Supabase Status Pill */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              isConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title={isConfigured ? `Conectado a ${url}` : 'Usando credenciales placeholder / Modo simulación'}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {isConfigured ? 'Supabase Conectado' : 'Modo Placeholder'}
            </span>
            <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
          </button>

          {/* Setup / Instructions Button */}
          <button
            onClick={onOpenHelp}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Guía de configuración del bucket 'temp-files'"
          >
            <HelpCircle className="w-4 h-4 text-orange-400" />
            <span className="hidden sm:inline">Guía Bucket</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium border border-slate-700/50"
            title="Configuración de Variables SUPABASE_URL / SUPABASE_ANON_KEY"
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">Credenciales</span>
          </button>
        </div>

      </div>
    </header>
  );
};
