import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, QrCode, ShieldAlert, FileText, Flame, Download, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { UploadedFileInfo } from '../types';
import { formatFileSize, getFileExtensionColor } from '../utils/formatters';
import { getSupabasePublicUrl, getTimeRemaining, downloadAndRemoveFromSupabase } from '../supabaseClient';

interface DownloadLinkCardProps {
  fileInfo: UploadedFileInfo;
  onOpenDownloadView: (filePath: string, fileName: string) => void;
  onItemDownloaded?: (filePath: string) => void;
}

export const DownloadLinkCard: React.FC<DownloadLinkCardProps> = ({
  fileInfo,
  onOpenDownloadView,
  onItemDownloaded,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Contador regresivo de 4 minutos
  const [timeInfo, setTimeInfo] = useState(() => getTimeRemaining(fileInfo.uploadedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(fileInfo.uploadedAt);
      setTimeInfo(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [fileInfo.uploadedAt]);

  const directUrl = getSupabasePublicUrl(fileInfo.filePath);
  const isExpired = fileInfo.expired || fileInfo.downloaded || timeInfo.isExpired;

  const handleCopyShare = () => {
    if (isExpired) return;
    navigator.clipboard.writeText(fileInfo.shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const handleCopyDirect = () => {
    if (isExpired || !directUrl) return;
    navigator.clipboard.writeText(directUrl);
    setCopiedDirect(true);
    setTimeout(() => setCopiedDirect(false), 2500);
  };

  const handleDirectDownloadAndDestroy = async () => {
    if (isExpired) return;
    setIsDownloading(true);
    try {
      const result = await downloadAndRemoveFromSupabase(fileInfo.filePath, fileInfo.fileName);
      if (result.success && result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileInfo.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 1000);

        if (onItemDownloaded) {
          onItemDownloaded(fileInfo.filePath);
        }
      } else {
        alert(result.error || 'No se pudo descargar el archivo.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al descargar y autodestruir el archivo');
    } finally {
      setIsDownloading(false);
    }
  };

  // Simple clean SVG QR Code generator logic for link
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fileInfo.shareUrl)}`;

  // Porcentaje restante (4 min = 240 s)
  const percentRemaining = Math.max(0, Math.min(100, (timeInfo.remainingSeconds / 240) * 100));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-fadeIn">
      
      {/* File Details */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
        <div className={`p-3 rounded-xl border ${getFileExtensionColor(fileInfo.fileName)}`}>
          <FileText className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-white truncate">
            {fileInfo.fileName}
          </p>
          <p className="text-xs text-slate-400">
            {formatFileSize(fileInfo.fileSize)} • Generado a las {new Date(fileInfo.uploadedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="space-y-4 opacity-100">
        {/* Enlace de descarga directo desde Supabase Storage */}
        {directUrl && (
          <div className={`p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 ${isExpired ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Link de Descarga Directa (Supabase Storage):
              </label>
              {!isExpired && (
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={fileInfo.fileName}
                  className="text-[11px] font-medium text-slate-400 hover:text-blue-300 transition flex items-center gap-1"
                >
                  Abrir directo <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={isExpired ? 'ENLACE EXPIRADO (ARCHIVO ELIMINADO)' : directUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-blue-300 focus:outline-none select-all truncate"
              />

              <button
                onClick={handleCopyDirect}
                disabled={isExpired}
                className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                  copiedDirect
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 disabled:opacity-50'
                }`}
              >
                {copiedDirect ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Enlace de descarga personalizado con autodestrucción */}
        <div className={`p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 ${isExpired ? 'opacity-40 pointer-events-none' : ''}`}>
          <label className="block text-xs font-bold text-orange-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 fill-orange-400" />
            Link de Descarga Autodestructible (App Page):
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={isExpired ? 'ENLACE EXPIRADO (ARCHIVO ELIMINADO)' : fileInfo.shareUrl}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-orange-300 focus:outline-none select-all truncate"
            />

            <button
              onClick={handleCopyShare}
              disabled={isExpired}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                copiedShare
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-orange-500 hover:bg-orange-600 text-slate-950 shadow-md shadow-orange-500/20 disabled:opacity-50'
              }`}
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="mt-6 flex flex-wrap gap-3">
        
        {/* Direct Download & Autodestruct Button */}
        <button
          onClick={handleDirectDownloadAndDestroy}
          disabled={isExpired || isDownloading}
          className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Descargando...</span>
            </>
          ) : (
            <>
              <Flame className="w-4 h-4 fill-slate-950" />
              <span>Descargar y Autodestruir Ahora</span>
            </>
          )}
        </button>

        {/* Test Open Download Page */}
        <button
          onClick={() => !isExpired && onOpenDownloadView(fileInfo.filePath, fileInfo.fileName)}
          disabled={isExpired}
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ExternalLink className="w-4 h-4 text-orange-400" />
          <span>Ver Página</span>
        </button>

        {/* QR Code Toggle */}
        {!isExpired && (
          <button
            onClick={() => setShowQr(!showQr)}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <QrCode className="w-4 h-4 text-slate-300" />
            {showQr ? 'Ocultar QR' : 'Ver QR'}
          </button>
        )}

      </div>

      {/* QR Code Display */}
      {showQr && !isExpired && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center animate-fadeIn">
          <p className="text-xs text-slate-400 mb-3">
            Escanea con la cámara de tu móvil para descargar y autodestruir
          </p>
          <img
            src={qrSvgUrl}
            alt="QR Code"
            className="w-40 h-40 bg-white p-2 rounded-xl border border-slate-700"
          />
        </div>
      )}



    </div>
  );
};

