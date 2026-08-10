import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, AlertCircle, Loader2, HardDriveUpload, PlusCircle, HelpCircle, ShieldAlert, Copy, Check, Trash2, X, Plus, Flame, Download } from 'lucide-react';
import { uploadToSupabaseBucket, tryCreateTempFilesBucket, downloadAndRemoveFromSupabase } from '../supabaseClient';
import { formatFileSize, getFileExtensionColor } from '../utils/formatters';
import { UploadedFileInfo } from '../types';

interface FileUploaderProps {
  onUploadSuccess: (info: UploadedFileInfo) => void;
  onOpenHelp?: () => void;
}

const MAX_FILE_SIZE_BYTES = 49 * 1024 * 1024; // 49 MB

const createChunkFile = (blob: Blob, name: string, lastModified: number, mimeType: string): File => {
  const fileType = mimeType || 'application/octet-stream';
  try {
    if (typeof File === 'function') {
      return new File([blob], name, {
        type: fileType,
        lastModified: lastModified || Date.now(),
      });
    }
  } catch (e) {
    // Fallback for browser environments where File constructor fails
  }
  const fileBlob = new Blob([blob], { type: fileType });
  Object.defineProperty(fileBlob, 'name', { value: name, writable: false, configurable: true });
  Object.defineProperty(fileBlob, 'lastModified', { value: lastModified || Date.now(), writable: false, configurable: true });
  return fileBlob as unknown as File;
};

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadSuccess,
  onOpenHelp,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [splitNotice, setSplitNotice] = useState<string | null>(null);
  const [isBucketError, setIsBucketError] = useState(false);
  const [isRlsError, setIsRlsError] = useState(false);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sqlPolicySnippet = `-- Copia y ejecuta este SQL en tu panel de Supabase > SQL Editor:

-- 1. Asegurar que el bucket "temp-files" sea público
INSERT INTO storage.buckets (id, name, public) 
VALUES ('temp-files', 'temp-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Políticas RLS para descargas y autodestrucción anónima
CREATE POLICY "Permitir Subida Anónima" ON storage.objects
FOR INSERT TO anon WITH CHECK (bucket_id = 'temp-files');

CREATE POLICY "Permitir Descarga Anónima" ON storage.objects
FOR SELECT TO anon USING (bucket_id = 'temp-files');

CREATE POLICY "Permitir Eliminar Anónimo" ON storage.objects
FOR DELETE TO anon USING (bucket_id = 'temp-files');`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlPolicySnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const addFiles = (incomingFiles: FileList | File[]) => {
    const incoming = Array.from(incomingFiles);
    if (incoming.length === 0) return;

    let splitCount = 0;
    const processedFiles: File[] = [];

    incoming.forEach((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        splitCount++;
        const totalParts = Math.ceil(file.size / MAX_FILE_SIZE_BYTES);
        const lastDot = file.name.lastIndexOf('.');
        const nameWithoutExt = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
        const ext = lastDot > 0 ? file.name.substring(lastDot) : '';

        for (let i = 0; i < totalParts; i++) {
          const start = i * MAX_FILE_SIZE_BYTES;
          const end = Math.min(file.size, (i + 1) * MAX_FILE_SIZE_BYTES);
          const chunkBlob = file.slice(start, end, file.type);
          const partFileName = `${nameWithoutExt} (Parte ${i + 1} de ${totalParts})${ext}`;
          const partFile = createChunkFile(
            chunkBlob,
            partFileName,
            file.lastModified,
            file.type || 'application/octet-stream'
          );
          processedFiles.push(partFile);
        }
      } else {
        processedFiles.push(file);
      }
    });

    if (splitCount > 0) {
      setSplitNotice(
        `Se evaluó el tamaño del archivo: ${
          splitCount === 1
            ? '1 archivo superaba los 49 MB y ha sido dividido automáticamente en partes.'
            : `${splitCount} archivos superaban los 49 MB y han sido divididos automáticamente en partes.`
        }`
      );
    }

    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newUnique = processedFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...newUnique];
    });
    setErrorMessage(null);
    setIsBucketError(false);
    setIsRlsError(false);
  };

  // Detectar y procesar archivos recibidos desde la acción Compartir de Android (Web Share Target API)
  useEffect(() => {
    async function checkSharedFiles() {
      if (typeof window === 'undefined' || !('caches' in window)) return;
      try {
        const hasSharedParam = window.location.search.includes('shared=true');
        const cache = await caches.open('twinlink-shared-files');
        const keys = await cache.keys();
        if (keys.length > 0 || hasSharedParam) {
          const filesToAdd: File[] = [];
          for (const req of keys) {
            const res = await cache.match(req);
            if (res) {
              const blob = await res.blob();
              const rawFileName = res.headers.get('x-file-name') || 'archivo_compartido';
              const fileName = decodeURIComponent(rawFileName);
              const fileType = res.headers.get('x-file-type') || blob.type || 'application/octet-stream';
              const file = createChunkFile(blob, fileName, Date.now(), fileType);
              filesToAdd.push(file);
              await cache.delete(req);
            }
          }
          if (filesToAdd.length > 0) {
            addFiles(filesToAdd);
          }
          if (hasSharedParam) {
            const cleanUrl = window.location.pathname + window.location.search.replace(/([?&])shared=true(&|$)/, '$1').replace(/[?&]$/, '');
            window.history.replaceState({}, '', cleanUrl || '/');
          }
        }
      } catch (err) {
        console.warn('Error recuperando archivos compartidos por Web Share Target:', err);
      }
    }
    checkSharedFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFileAt = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrorMessage(null);
    setSplitNotice(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    setIsBucketError(false);
    setIsRlsError(false);

    let hasErrors = false;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setCurrentUploadingIndex(i);
      setUploadProgress(10);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 120);

      try {
        const result = await uploadToSupabaseBucket(file);
        clearInterval(progressInterval);

        if (!result.success) {
          hasErrors = true;
          setErrorMessage(result.error || `Error al subir ${file.name}`);
          setIsBucketError(Boolean(result.isBucketError));
          setIsRlsError(Boolean(result.isRlsError));
          break;
        }

        setUploadProgress(100);

        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?file=${encodeURIComponent(result.filePath)}&name=${encodeURIComponent(result.fileName)}`;

        const newFileInfo: UploadedFileInfo = {
          id: Math.random().toString(36).substring(2, 9),
          filePath: result.filePath,
          fileName: result.fileName,
          fileSize: result.fileSize,
          fileType: result.fileType,
          uploadedAt: new Date().toISOString(),
          shareUrl,
          downloaded: false,
        };

        onUploadSuccess(newFileInfo);
      } catch (err: any) {
        clearInterval(progressInterval);
        hasErrors = true;
        setErrorMessage(err.message || `Error inesperado al subir ${file.name}`);
        break;
      }
    }

    if (!hasErrors) {
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    setIsUploading(false);
    setUploadProgress(0);
    setCurrentUploadingIndex(0);
  };

  const handleCreateBucket = async () => {
    setIsCreatingBucket(true);
    const res = await tryCreateTempFilesBucket();
    setIsCreatingBucket(false);

    if (res.success) {
      setErrorMessage(null);
      setIsBucketError(false);
      setIsRlsError(false);
      handleUpload();
    } else {
      setErrorMessage(res.message);
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
      
      {/* Subtle Background Glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Hidden input supporting multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
          isDragging
            ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
            : selectedFiles.length > 0
            ? 'border-orange-500/40 bg-slate-950/40 hover:bg-slate-950/60'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400 mb-3 shadow-inner">
            <Upload className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-200">
            <span className="hidden sm:inline">
              Arrastra tus archivos aquí o <span className="text-orange-400 underline">haz clic para examinar</span>
            </span>
            <span className="sm:hidden text-orange-400 underline">
              haz clic para examinar
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Puedes seleccionar varios archivos simultáneamente (documentos, imágenes, videos, comprimidos)
          </p>
          <p className="text-[11px] text-cyan-400/90 font-medium mt-2 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1 rounded-full inline-block">
            ⚡ Los archivos mayores a 49 MB se dividen automáticamente en partes antes de subir
          </p>
        </div>
      </div>

      {/* Split Notice Banner */}
      {splitNotice && (
        <div className="mt-4 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <PlusCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{splitNotice}</span>
          </div>
          <button
            onClick={() => setSplitNotice(null)}
            className="text-cyan-400 hover:text-white p-1 rounded-lg hover:bg-cyan-900/50"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">
              Archivos seleccionados ({selectedFiles.length})
            </span>
            <div className="flex items-center gap-3">
              <span>Tamaño total: {formatFileSize(totalSize)}</span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={clearAllFiles}
                  className="text-xs text-slate-400 hover:text-red-400 transition flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-red-500/30"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar todo
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${idx}`}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                  isUploading && idx === currentUploadingIndex
                    ? 'bg-orange-500/10 border-orange-500/50'
                    : isUploading && idx < currentUploadingIndex
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getFileExtensionColor(file.name)}`}>
                    <File className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(file.size)} • {file.type || 'Archivo'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isUploading && idx === currentUploadingIndex && (
                    <span className="flex items-center gap-1 text-xs text-orange-400 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Subiendo...
                    </span>
                  )}
                  {isUploading && idx < currentUploadingIndex && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Completado
                    </span>
                  )}
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => removeFileAt(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
                      title="Quitar de la lista"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>


        </div>
      )}

      {/* Error Message & Interactive Fix Banner */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <strong className="font-bold text-red-200 block mb-0.5">Error al subir a Supabase Storage:</strong>
              <span>{errorMessage}</span>
            </div>
          </div>

          {/* RLS Policy Fix Section */}
          {(isRlsError || errorMessage.toLowerCase().includes('security policy') || errorMessage.toLowerCase().includes('rls')) && (
            <div className="pt-3 border-t border-red-500/20 space-y-3">
              <div className="flex items-center justify-between text-slate-200 font-semibold text-xs">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Solución: Habilitar Políticas RLS en Supabase
                </span>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-slate-300 hover:text-orange-300 transition flex items-center gap-1 text-[11px]"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">¡SQL Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-orange-400" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto relative">
                <pre className="text-orange-300 whitespace-pre leading-relaxed">{sqlPolicySnippet}</pre>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-slate-200">Instrucciones:</strong> Ve a tu panel de Supabase &gt; <strong className="text-slate-200">SQL Editor</strong> &gt; Pega este código y presiona <strong className="text-slate-200">Run</strong>. Luego reintenta subir tu archivo.
              </p>
            </div>
          )}

          {/* If it's a bucket error, offer direct buttons */}
          {(isBucketError || errorMessage.toLowerCase().includes('bucket not found')) && (
            <div className="pt-2 flex flex-wrap gap-2 border-t border-red-500/20">
              <button
                type="button"
                disabled={isCreatingBucket}
                onClick={handleCreateBucket}
                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                {isCreatingBucket ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creando Bucket...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    Crear Bucket "temp-files"
                  </>
                )}
              </button>

              {onOpenHelp && (
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1.5 border border-slate-700"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
                  Ver Guía de Creación en Supabase
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress Bar during uploading */}
      {isUploading && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 font-medium text-orange-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Subiendo archivo {currentUploadingIndex + 1} de {selectedFiles.length}...
            </span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Upload CTA Button */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleUpload}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Upload className="w-4 h-4" />
            <span>
              {selectedFiles.length === 1
                ? 'Subir 1 archivo'
                : `Subir ${selectedFiles.length} archivos`}
            </span>
          </button>
        </div>
      )}

    </div>
  );
};

