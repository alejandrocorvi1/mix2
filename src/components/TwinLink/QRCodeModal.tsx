import React, { useState } from 'react';
import { X, Copy, Check, QrCode, ExternalLink, Share2 } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate full share URL
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?code=${encodeURIComponent(roomCode)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}&color=00d8f6&bgcolor=0b101d`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-sm bg-[#0b101d] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 p-6 space-y-5 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400">
            <QrCode className="w-5 h-5" />
            <h3 className="font-semibold text-lg text-white">Código QR de la Sala</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Code Badge */}
        <div className="text-center">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Código de Sala</span>
          <div className="text-2xl font-mono font-bold text-cyan-400 tracking-wider mt-0.5">
            {roomCode}
          </div>
        </div>

        {/* QR Image Frame */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl relative group">
          <img
            src={qrImageUrl}
            alt={`Código QR para unirse a la sala ${roomCode}`}
            className="w-48 h-48 rounded-lg shadow-md border border-cyan-500/20"
            loading="lazy"
          />
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            Escanear para unirse al instante
          </p>
        </div>

        {/* Direct Link Input & Copy */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 block">Enlace directo:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500/50 select-all"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl transition-all active:scale-95 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
