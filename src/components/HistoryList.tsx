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
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingIndex, setDownloadingIndex] = useState(0);

  if (files.length === 0) return null;

  const handleDownloadAllAndDestroy = async () => {
    if (files.length === 0 || isDownloadingAll) return;

    setIsDownloadingAll(true);
    setDownloadingIndex(0);

    const filesToDownload = [...files];

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      setDownloadingIndex(i);

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
            await onItemDownloaded(file.filePath, file.id);
          }
        } else {
          console.warn(`Error al descargar ${file.fileName}:`, result.error);
        }
      } catch (err: any) {
        console.error(`Error procesando descarga de ${file.fileName}:`, err);
      }

      if (i < filesToDownload.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsDownloadingAll(false);
    setDownloadingIndex(0);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mt-8">
      
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <h3 className="font-bold text-white text-base">Archivos Subidos</h3>
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
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3"
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
            </div>
          );
        })}
      </div>

      {/* Botón inferior para descargar y eliminar todos los archivos */}
      {files.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleDownloadAllAndDestroy}
            disabled={isDownloadingAll}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
          >
            {isDownloadingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Descargando {downloadingIndex + 1} de {files.length}...</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 fill-slate-950" />
                <span>
                  {files.length === 1
                    ? 'Descargar y Eliminar 1 archivo'
                    : `Descargar y Eliminar (${files.length} archivos)`}
                </span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
};
