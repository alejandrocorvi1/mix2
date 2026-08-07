import React from 'react';
import { X, FolderPlus, ShieldCheck, Code, ArrowRight, Database } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Configuración del Bucket "temp-files"</h2>
            <p className="text-xs text-slate-400">
              Guía paso a paso para Supabase Storage
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 text-sm text-slate-300">
          
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-400" />
                Crear el Bucket en Supabase
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ve a tu panel de Supabase &gt; <strong className="text-slate-200">Storage</strong> &gt; <strong className="text-slate-200">New bucket</strong>.
              </p>
              <div className="mt-2 bg-slate-900 p-2 rounded border border-slate-800 font-mono text-xs text-orange-300">
                Nombre del bucket: <span className="font-bold text-white">temp-files</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Permisos del Bucket (Public o RLS)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Puedes marcar el bucket como <strong className="text-slate-200">Public bucket</strong>, o si usas políticas RLS, asegúrate de otorgar permisos <code className="text-orange-300 font-mono">SELECT</code>, <code className="text-orange-300 font-mono">INSERT</code> y <code className="text-orange-300 font-mono">DELETE</code> para el rol <code className="text-orange-300 font-mono">anon</code>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-400" />
                Métodos Utilizados en el Código
              </h3>
              <div className="mt-2 space-y-2 font-mono text-xs">
                <div className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-300">
                  <span className="text-slate-500">// Subir archivo (Requisito 1)</span><br />
                  <span className="text-purple-400">await</span> supabase.storage.<span className="text-orange-300">from</span>(<span className="text-emerald-300">'temp-files'</span>).<span className="text-blue-300">upload</span>(filePath, file);
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-300">
                  <span className="text-slate-500">// Descargar y autodestruir (Requisito 3)</span><br />
                  <span className="text-purple-400">await</span> supabase.storage.<span className="text-orange-300">from</span>(<span className="text-emerald-300">'temp-files'</span>).<span className="text-blue-300">download</span>(filePath);<br />
                  <span className="text-purple-400">await</span> supabase.storage.<span className="text-orange-300">from</span>(<span className="text-emerald-300">'temp-files'</span>).<span className="text-red-400">remove</span>([filePath]);
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-slate-950 rounded-xl transition flex items-center gap-2"
          >
            Entendido
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
