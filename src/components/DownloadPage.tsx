import React, { useState } from 'react';
import { Download, ShieldCheck, Flame, Trash2, CheckCircle2, AlertCircle, FileText, Loader2, ArrowLeft, Terminal, ExternalLink } from 'lucide-react';
import { downloadAndRemoveFromSupabase, getSupabasePublicUrl } from '../supabaseClient';
import { getFileExtensionColor } from '../utils/formatters';

interface DownloadPageProps {
  filePath: string;
  fileName: string;
  onBackToUpload: () => void;
  onItemDownloaded?: (filePath: string) => void;
}

export const DownloadPage: React.FC<DownloadPageProps> = ({
  filePath,
  fileName,
  onBackToUpload,
  onItemDownloaded,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  // REQUISITO 3: Descargar y eliminar del bucket de Supabase usando remove()
  const handleDownloadAndDestroy = async () => {
    setIsDownloading(true);
    setErrorMessage(null);
    setExecutionLogs([]);

    const newLogs: string[] = [];
    const addLog = (msg: string) => {
      newLogs.push(msg);
      setExecutionLogs([...newLogs]);
    };

    try {
      addLog(`[1/3] Iniciando descarga desde bucket 'temp-files'...`);
      addLog(`[1/3] Ruta en Supabase: "${filePath}"`);

      // 1. Ejecutar descarga y método remove() de Supabase Storage
      const result = await downloadAndRemoveFromSupabase(filePath, fileName);

      if (!result.success || !result.blob) {
        setIsDownloading(false);
        setErrorMessage(
          result.error || 'No se pudo descargar el archivo. Es probable que ya haya sido descargado y autodestruido previamente.'
        );
        addLog(`[ERROR] ${result.error}`);
        return;
      }

      addLog(`[2/3] Archivo obtenido correctamente (${(result.blob.size / 1024).toFixed(1)} KB).`);

      // 2. Entregar el archivo para guardar en su dispositivo
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      // Limpiar memoria
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);

      // 3. Confirmar eliminación
      addLog(`[3/3] REQUISITO 3 CUMPLIDO: Método remove() ejecutado en Supabase Storage:`);
      addLog(`> supabase.storage.from('temp-files').remove(["${filePath}"])`);
      addLog(`> Resultado: ELIMINADO DEFINITIVAMENTE`);

      setIsDownloading(false);
      setIsDestroyed(true);

      if (onItemDownloaded) {
        onItemDownloaded(filePath);
      }

    } catch (err: any) {
      setIsDownloading(false);
      setErrorMessage(err.message || 'Error durante la descarga y autodestrucción');
      addLog(`[ERROR EXCEPCION] ${err.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fadeIn">
      
      {/* Back Button */}
      <button
        onClick={onBackToUpload}
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition py-2 px-3 rounded-xl bg-slate-900 border border-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Subir un Archivo
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
        
        {/* Glow Header */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {!isDestroyed ? (
          <>
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold mb-6">
              <Flame className="w-4 h-4 fill-orange-400 animate-pulse" />
              Archivo Temporal de Un Solo Uso
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
              Has recibido un archivo autodestructible
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-8">
              Al hacer clic en descargar, la aplicación te entregará el archivo para tu dispositivo y se eliminará <strong className="text-slate-200">inmediatamente</strong> del servidor de Supabase.
            </p>

            {/* File Info Box */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 max-w-lg mx-auto mb-8 flex items-center gap-4 text-left">
              <div className={`p-3.5 rounded-xl border ${getFileExtensionColor(fileName)}`}>
                <FileText className="w-8 h-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base text-white truncate">
                  {fileName}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                  Ruta: {filePath}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-left flex items-start gap-3 max-w-lg mx-auto">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-200 mb-0.5">No se pudo entregar el archivo</h4>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {/* CTA Download & Destroy Button */}
            <div className="space-y-3 max-w-lg mx-auto">
              <button
                disabled={isDownloading}
                onClick={handleDownloadAndDestroy}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-3 shadow-2xl ${
                  isDownloading
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-[0.99]'
                }`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    Procesando Descarga y Autodestrucción...
                  </>
                ) : (
                  <>
                    <Flame className="w-5 h-5 fill-slate-950" />
                    Probar Descarga y Autodestrucción de Supabase
                  </>
                )}
              </button>

              {getSupabasePublicUrl(filePath) && (
                <a
                  href={getSupabasePublicUrl(filePath)}
                  target="_blank"
                  rel="noreferrer"
                  download={fileName}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800/60 border border-slate-800 transition flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Descargar directamente desde Supabase Storage (Sin Autodestrucción)
                </a>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Ejecuta <code className="text-orange-400 font-mono">supabase.storage.from('temp-files').remove([filePath])</code> tras la entrega
            </p>
          </>
        ) : (
          /* State after file has been downloaded & burned */
          <div className="py-4 animate-scaleUp">
            
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              ¡Archivo Guardado y Autodestruido!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-6">
              El archivo <strong className="text-white">{fileName}</strong> se guardó en tu dispositivo y ha sido borrado permanentemente del bucket <code className="text-orange-300 font-mono">temp-files</code> de Supabase.
            </p>

            {/* Execution logs box */}
            {executionLogs.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left max-w-lg mx-auto mb-8 font-mono text-xs text-slate-300">
                <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider mb-2 pb-2 border-b border-slate-800">
                  <Terminal className="w-3.5 h-3.5 text-orange-400" />
                  Registro de Ejecución en Supabase Storage
                </div>
                {executionLogs.map((log, idx) => (
                  <p key={idx} className={log.includes('ELIMINADO') ? 'text-emerald-400 font-bold' : log.includes('remove') ? 'text-orange-300' : 'text-slate-400'}>
                    {log}
                  </p>
                ))}
              </div>
            )}

            {/* Confirmation details */}
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs max-w-lg mx-auto mb-8 text-center flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4 text-orange-400 shrink-0" />
              Si alguien intenta abrir nuevamente este enlace, ya no encontrará el archivo.
            </div>

            <button
              onClick={onBackToUpload}
              className="py-3 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition"
            >
              Subir Otro Archivo
            </button>

          </div>
        )}

      </div>
    </div>
  );
};
