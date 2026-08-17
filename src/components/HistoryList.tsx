import React, { useState, useEffect } from 'react';
import { Clock, FileText, Flame, Trash2, Loader2, Folder, HelpCircle, Settings, AlertCircle, ExternalLink, Download } from 'lucide-react';
import { UploadedFileInfo } from '../types';
import { formatFileSize, getFileExtensionColor } from '../utils/formatters';
import { downloadAndRemoveFromSupabase } from '../supabaseClient';

interface HistoryListProps {
  files: UploadedFileInfo[];
  fileLogs?: UploadedFileInfo[];
  roomCode?: string;
  onOpenDownloadView?: (filePath: string, fileName: string) => void;
  onClearHistory: () => void;
  onItemDownloaded?: (filePath: string, fileId: string) => void;
}

// Helpers para guardar y recuperar el handle de la carpeta fija en IndexedDB
const IDB_NAME = 'twinlink_idb';
const IDB_STORE = 'settings';

async function saveStoredDirectoryHandle(handle: any) {
  try {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) return;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, 'fixed_dir_handle');
    };
  } catch (e) {
    console.warn('Error guardando handle en IndexedDB:', e);
  }
}

async function getStoredDirectoryHandle(): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get('fixed_dir_handle');
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const HistoryList: React.FC<HistoryListProps> = ({
  files,
  fileLogs = [],
  roomCode = '',
  onClearHistory,
  onItemDownloaded,
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingIndex, setDownloadingIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Selector de modo de descarga: 'fixed' (Carpeta Fija) o 'ask' (Preguntar Siempre)
  const [downloadMode, setDownloadMode] = useState<'fixed' | 'ask'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('twinlink_download_mode');
        if (saved === 'fixed' || saved === 'ask') return saved;
      } catch (e) {
        console.warn('No se pudo acceder a localStorage:', e);
      }
    }
    return 'ask';
  });

  // State para notificar al usuario si el navegador bloquea showDirectoryPicker por estar dentro de un iframe
  const [iframeNotice, setIframeNotice] = useState(false);

  // Handle de la carpeta fija seleccionada para la sesión
  const [fixedDirHandle, setFixedDirHandle] = useState<any | null>(null);

  // Detección de soporte para File System Access API (no soportado en Safari / iOS / Apple)
  const isFileSystemAccessSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Restaurar handle de carpeta fija guardado al cargar el componente
  useEffect(() => {
    if (isFileSystemAccessSupported) {
      getStoredDirectoryHandle().then((handle) => {
        if (handle) {
          setFixedDirHandle(handle);
        }
      });
    }
  }, [isFileSystemAccessSupported]);

  // Persistir la preferencia de modo de descarga siempre que cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('twinlink_download_mode', downloadMode);
      } catch (e) {
        console.warn('No se pudo guardar preferencia en localStorage:', e);
      }
    }
  }, [downloadMode]);

  if (files.length === 0) return null;

  // Acción para seleccionar la carpeta fija
  const handlePickFixedFolder = async () => {
    if (!isFileSystemAccessSupported) return;
    setIframeNotice(false);
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      setFixedDirHandle(handle);
      saveStoredDirectoryHandle(handle);
      setDownloadMode('fixed');
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('twinlink_download_mode', 'fixed');
        } catch (e) {
          console.warn(e);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Usuario canceló deliberadamente el selector
        return;
      }
      console.warn('Error/Restricción al abrir el selector de carpetas:', err);
      if (err.name === 'SecurityError' || (typeof window !== 'undefined' && window.self !== window.top)) {
        setIframeNotice(true);
      }
    }
  };

  const handleSelectFixedMode = async () => {
    setDownloadMode('fixed');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('twinlink_download_mode', 'fixed');
      } catch (e) {
        console.warn(e);
      }
    }
    if (!fixedDirHandle && isFileSystemAccessSupported) {
      await handlePickFixedFolder();
    }
  };

  const handleSelectAskMode = () => {
    setDownloadMode('ask');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('twinlink_download_mode', 'ask');
      } catch (e) {
        console.warn(e);
      }
    }
    setIframeNotice(false);
  };

  const handleDownloadAllAndDestroy = async () => {
    if (files.length === 0 || isDownloadingAll) return;

    // Ocultar el panel de selector al iniciar la descarga
    setShowSettings(false);

    let targetDirHandle: any = null;

    // Si el navegador soporta File System Access API
    if (isFileSystemAccessSupported) {
      if (downloadMode === 'fixed') {
        if (fixedDirHandle) {
          targetDirHandle = fixedDirHandle;
          // Verificar / pedir permisos para la carpeta recuperada
          try {
            if (typeof targetDirHandle.queryPermission === 'function') {
              let status = await targetDirHandle.queryPermission({ mode: 'readwrite' });
              if (status !== 'granted' && typeof targetDirHandle.requestPermission === 'function') {
                status = await targetDirHandle.requestPermission({ mode: 'readwrite' });
              }
              if (status !== 'granted') {
                // Si se deniega el permiso, pedir seleccionar carpeta de nuevo
                targetDirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                setFixedDirHandle(targetDirHandle);
                saveStoredDirectoryHandle(targetDirHandle);
              }
            }
          } catch (pErr) {
            console.warn('Error al solicitar permiso para la carpeta fija:', pErr);
          }
        } else {
          try {
            targetDirHandle = await (window as any).showDirectoryPicker({
              mode: 'readwrite',
            });
            setFixedDirHandle(targetDirHandle);
            saveStoredDirectoryHandle(targetDirHandle);
          } catch (err: any) {
            if (err.name === 'AbortError') {
              return;
            }
            console.warn('Acceso a carpeta restringido en este entorno. Se usará descarga estándar.', err);
            targetDirHandle = null;
          }
        }
      } else if (downloadMode === 'ask') {
        // En modo "Preguntar siempre", se abre la ventana del navegador para elegir la carpeta cada vez que se presiona el botón
        try {
          targetDirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
          });
        } catch (err: any) {
          if (err.name === 'AbortError') {
            // Si el usuario cancela la selección de carpeta, abortamos el proceso
            return;
          }
          console.warn('Acceso a carpeta restringido o cancelado. Usando descarga por defecto.', err);
          targetDirHandle = null;
        }
      }
    }

    setIsDownloadingAll(true);
    setDownloadingIndex(0);

    const groupsToDownload = groupFilesByReassembly(files);

    for (let i = 0; i < groupsToDownload.length; i++) {
      const group = groupsToDownload[i];
      setDownloadingIndex(i);

      try {
        const blobs: Blob[] = [];
        let allPartsSuccess = true;

        for (const partFile of group.files) {
          const result = await downloadAndRemoveFromSupabase(partFile.filePath, partFile.fileName, {
            roomCode: roomCode || 'General',
            fileSize: partFile.fileSize
          });
          if (result.success && result.blob) {
            blobs.push(result.blob);
          } else {
            allPartsSuccess = false;
            console.warn(`Error al descargar parte ${partFile.fileName}:`, result.error);
          }
        }

        if (allPartsSuccess && blobs.length > 0) {
          // Reensamblar todas las partes en un único Blob continuo
          const combinedBlob = new Blob(blobs, { type: blobs[0].type || 'application/octet-stream' });
          let savedViaFS = false;

          if (targetDirHandle) {
            try {
              if (typeof targetDirHandle.queryPermission === 'function') {
                const status = await targetDirHandle.queryPermission({ mode: 'readwrite' });
                if (status !== 'granted' && typeof targetDirHandle.requestPermission === 'function') {
                  await targetDirHandle.requestPermission({ mode: 'readwrite' });
                }
              }

              const fileHandle = await targetDirHandle.getFileHandle(group.displayName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(combinedBlob);
              await writable.close();
              savedViaFS = true;
            } catch (fsErr) {
              console.warn(`Error guardando en la carpeta seleccionada para ${group.displayName}, usando descarga estándar:`, fsErr);
              savedViaFS = false;
            }
          }

          if (!savedViaFS) {
            const url = window.URL.createObjectURL(combinedBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = group.displayName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }, 1000);
          }

          // Eliminar cada parte descargada de la BD/almacenamiento
          if (onItemDownloaded) {
            for (const partFile of group.files) {
              await onItemDownloaded(partFile.filePath, partFile.id);
            }
          }
        }
      } catch (err: any) {
        console.error(`Error procesando descarga de ${group.displayName}:`, err);
      }

      if (i < groupsToDownload.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsDownloadingAll(false);
    setDownloadingIndex(0);
  };

  // Export history log as UTF-8 .txt file
  const handleDownloadHistoryTxt = () => {
    const listToExport = fileLogs.length > 0 ? fileLogs : files;
    const room = roomCode || 'General';
    const now = new Date().toLocaleString('es-ES');

    let textContent = `===============================================\n`;
    textContent += `     REGISTRO DE ARCHIVOS SUBIDOS - TWINLINK\n`;
    textContent += `===============================================\n`;
    textContent += `Código de Sala: ${room}\n`;
    textContent += `Fecha de exportación: ${now}\n`;
    textContent += `Total de archivos registrados: ${listToExport.length}\n`;
    textContent += `-----------------------------------------------\n\n`;

    if (listToExport.length === 0) {
      textContent += `No se han registrado archivos subidos en esta sala.\n`;
    } else {
      listToExport.forEach((item, index) => {
        const dateStr = item.uploadedAt ? new Date(item.uploadedAt).toLocaleString('es-ES') : 'Fecha no registrada';
        const sizeStr = formatFileSize(item.fileSize);
        textContent += `${index + 1}. ${item.fileName}\n`;
        textContent += `   Tamaño: ${sizeStr}\n`;
        textContent += `   Fecha de subida: ${dateStr}\n\n`;
      });
    }

    // Explicit UTF-8 BOM byte order mark
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Registro_Archivos_${room.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper para agrupar fragmentos de archivos divididos (>49MB)
  const groupFilesByReassembly = (fileList: UploadedFileInfo[]) => {
    const map = new Map<string, { baseName: string; ext: string; totalParts: number; items: { partIndex: number; file: UploadedFileInfo }[] }>();
    const standaloneUnits: {
      id: string;
      displayName: string;
      totalSize: number;
      isFragmented: boolean;
      totalParts: number;
      availablePartsCount: number;
      files: UploadedFileInfo[];
    }[] = [];

    const PART_REGEX = /^(.+) \(Parte (\d+) de (\d+)\)(\.[^.]+)?$/i;

    fileList.forEach((file) => {
      const match = file.fileName.match(PART_REGEX);
      if (match) {
        const baseName = match[1];
        const partIndex = parseInt(match[2], 10);
        const totalParts = parseInt(match[3], 10);
        const ext = match[4] || '';
        const key = `${baseName}${ext}`;

        if (!map.has(key)) {
          map.set(key, { baseName, ext, totalParts, items: [] });
        }
        map.get(key)!.items.push({ partIndex, file });
      } else {
        standaloneUnits.push({
          id: file.id,
          displayName: file.fileName,
          totalSize: file.fileSize,
          isFragmented: false,
          totalParts: 1,
          availablePartsCount: 1,
          files: [file],
        });
      }
    });

    const groupedUnits: {
      id: string;
      displayName: string;
      totalSize: number;
      isFragmented: boolean;
      totalParts: number;
      availablePartsCount: number;
      files: UploadedFileInfo[];
    }[] = [];

    map.forEach((group, key) => {
      group.items.sort((a, b) => a.partIndex - b.partIndex);
      const sortedFiles = group.items.map((it) => it.file);
      const totalSize = sortedFiles.reduce((acc, f) => acc + f.fileSize, 0);

      groupedUnits.push({
        id: `group-${key}`,
        displayName: key,
        totalSize,
        isFragmented: true,
        totalParts: group.totalParts,
        availablePartsCount: sortedFiles.length,
        files: sortedFiles,
      });
    });

    return [...standaloneUnits, ...groupedUnits];
  };

  const fileGroups = groupFilesByReassembly(files);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mt-8">
      
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadHistoryTxt}
            title="Descargar registro de archivos subidos (.txt)"
            className="p-1 -m-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center active:scale-95 group focus:outline-none"
          >
            <Clock className="w-5 h-5 text-orange-400 group-hover:text-orange-300 transition-colors" />
          </button>
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
        {fileGroups.map((group) => {
          return (
            <div
              key={group.id}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl border shrink-0 ${getFileExtensionColor(group.displayName)}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-white truncate">
                    {group.displayName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{formatFileSize(group.totalSize)}</span>
                    {group.isFragmented && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1">
                        ⚡ {group.availablePartsCount}/{group.totalParts} partes (Reensamblable)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón inferior para descargar y eliminar todos los archivos */}
      {files.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
          
          {/* Selector de modo de descarga (Visible únicamente en navegadores compatibles con File System Access API) */}
          {isFileSystemAccessSupported && showSettings && (
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-2 transition-all">
              <div className="flex items-center justify-between px-2 pt-0.5 text-[11px] font-semibold text-slate-400">
                <span>CONFIGURACIÓN DE DESCARGA</span>
                <span className="text-cyan-400 font-mono text-[10px]">TwinLink</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectFixedMode}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    downloadMode === 'fixed'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span className="truncate">Elegir Carpeta Fija</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAskMode}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    downloadMode === 'ask'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="truncate">Preguntar Siempre</span>
                </button>
              </div>

              {/* Sub-indicador de carpeta fija seleccionada */}
              {downloadMode === 'fixed' && (
                <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                  <span className="truncate">
                    {fixedDirHandle ? (
                      <span className="text-slate-300">
                        Carpeta fija: <strong className="text-cyan-300 font-mono">{fixedDirHandle.name}</strong>
                      </span>
                    ) : (
                      'Sin carpeta fija asignada'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handlePickFixedFolder}
                    className="text-cyan-400 hover:text-cyan-300 font-medium underline ml-2 shrink-0 transition-colors"
                  >
                    {fixedDirHandle ? 'Cambiar' : 'Elegir'}
                  </button>
                </div>
              )}

              {/* Banner informativo si el navegador bloquea la llamada por estar en iframe */}
              {iframeNotice && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Abre la app en Pestaña Nueva</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    El navegador (Chrome/Edge) prohíbe seleccionar carpetas del disco cuando la app se ejecuta dentro de un visor de desarrollo integrados (iframe). Abre la app en una pestaña independiente para utilizar el selector nativo.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="mt-1 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs border border-amber-500/40 transition flex items-center justify-center gap-1.5"
                  >
                    <span>Abrir App en Nueva Pestaña</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Fila con Botón principal de descarga y Botón de engranaje (solo en navegadores con soporte) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAllAndDestroy}
              disabled={isDownloadingAll}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
            >
              {isDownloadingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reensamblando y descargando {downloadingIndex + 1} de {fileGroups.length}...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  {/* Vista Móvil (< sm): Centrado en 2 líneas */}
                  <div className="flex flex-col items-center justify-center text-center leading-tight sm:hidden">
                    <span className="font-bold">Descargar y Eliminar</span>
                    <span className="text-xs opacity-90 font-medium">
                      {fileGroups.length === 1 ? '(1 archivo)' : `(${fileGroups.length} archivos)`}
                    </span>
                  </div>

                  {/* Vista PC (>= sm): En 1 sola línea sin modificación */}
                  <span className="hidden sm:inline">
                    {fileGroups.length === 1
                      ? (fileGroups[0]?.isFragmented
                          ? `Reensamblar, Descargar y Eliminar ${fileGroups[0].displayName}`
                          : 'Descargar y Eliminar 1 archivo')
                      : `Descargar y Eliminar (${fileGroups.length} archivos)`}
                  </span>
                </>
              )}
            </button>

            {/* Icono de engranaje para configurar opciones de descarga (Solo en navegadores compatibles como Chrome/Edge de escritorio) */}
            {isFileSystemAccessSupported && (
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                title="Configurar opciones de carpeta de descarga"
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center shrink-0 ${
                  showSettings
                    ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
