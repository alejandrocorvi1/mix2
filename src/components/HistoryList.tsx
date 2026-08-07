import React, { useState } from 'react';
import { Clock, FileText, Flame, Trash2, Loader2 } from 'lucide-react';
import { UploadedFileInfo } from '../types';
import { formatFileSize, getFileExtensionColor } from '../utils/formatters';
import { downloadAndRemoveFromSupabase } from '../supabaseClient';

interface HistoryListProps {
  files: UploadedFileInfo[];
  onOpenDownloadView?: (filePath: string, fileName: string) => void;
  onClearHistory: () => void;
  onItemDownloaded?: (filePath: string, fileId: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  files,
  onClearHistory,
  onItemDownloaded,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (files.length === 0) return null;

  const handleDownloadAndDestroy = async (file: UploadedFileInfo) => {
    setDownloadingId(file.id);
    try {
      const result = await downloadAndRemoveFromSupabase(file.filePath, file.fileName);
      if (result.success && result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 1000);

        if (onItemDownloaded) {
          onItemDownloaded(file.filePath, file.id);
        }
      } else {
        alert(result.error || 'No se pudo descargar el archivo.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al descargar y autodestruir el archivo');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mt-8">
      
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <h3 className="font-bold text-white text-base">Archivos Subidos en esta Sesión</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            {files.length}
          </span>
        </div>

        <button
          onClick={onClearHistory}
          className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpiar Lista
        </button>
      </div>

      <div className="space-y-3">
        {files.map((file) => {
          return (
            <div
              key={file.id}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl border shrink-0 ${getFileExtensionColor(file.fileName)}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-white truncate">
                    {file.fileName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{formatFileSize(file.fileSize)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => handleDownloadAndDestroy(file)}
                  disabled={downloadingId === file.id}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-orange-500/10 disabled:opacity-50"
                  title="Descargar archivo y autodestruir inmediatamente de Supabase"
                >
                  {downloadingId === file.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Descargando...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Descargar y Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
