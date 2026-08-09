import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut,
  QrCode,
  Copy,
  Check,
  Send,
  Download,
  Trash2,
  Radio,
  AlertTriangle,
  X,
  Share2,
  FolderOpen,
  FileUp,
  MessageSquare,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, ensureAnonymousAuth } from '../../lib/firebase';
import { getDeviceId, addRecentCode } from '../../lib/device';
import { QRCodeModal } from './QRCodeModal';
import { FileUploader } from '../FileUploader';
import { HistoryList } from '../HistoryList';
import { UploadedFileInfo } from '../../types';
import { deleteFileFromSupabase } from '../../supabaseClient';

interface SharedPanelProps {
  roomCode: string;
  onExit: () => void;
  onOpenHelp?: () => void;
}

interface MessageItem {
  id: string;
  text: string;
  senderId: string;
  role: string;
  createdAt: any;
}

interface PresenceItem {
  deviceId: string;
  lastSeen: any;
  joinedAt: any;
  role: string;
}

export const SharedPanel: React.FC<SharedPanelProps> = ({ roomCode, onExit, onOpenHelp }) => {
  const currentDeviceId = getDeviceId();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectedCount, setConnectedCount] = useState<number>(1);
  const [isHost, setIsHost] = useState<boolean>(false);

  // Shared Room Files
  const [roomFiles, setRoomFiles] = useState<UploadedFileInfo[]>([]);

  // UI state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedChat, setCopiedChat] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const connectedCountRef = useRef<number>(connectedCount);

  // Keep ref updated
  useEffect(() => {
    connectedCountRef.current = connectedCount;
  }, [connectedCount]);

  // Save to recent codes history & ensure anonymous auth
  useEffect(() => {
    let isMounted = true;
    addRecentCode(roomCode);
    ensureAnonymousAuth()
      .then(() => {
        if (isMounted) setIsAuthReady(true);
      })
      .catch((err) => {
        console.warn('Anonymous auth init error:', err);
        if (isMounted) setIsAuthReady(true);
      });
    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // Handle manual exit with presence cleanup
  const handleExitRoom = async () => {
    try {
      const presenceRef = doc(db, 'sessions', roomCode, 'presence', currentDeviceId);
      await deleteDoc(presenceRef);
    } catch (err) {
      console.warn('Error deleting presence on manual exit:', err);
    }
    onExit();
  };

  // 1. Initialize room session & adaptive heartbeat
  useEffect(() => {
    if (!isAuthReady) return;
    let timerId: NodeJS.Timeout;
    let isCancelled = false;

    const removePresence = () => {
      try {
        const presenceRef = doc(db, 'sessions', roomCode, 'presence', currentDeviceId);
        deleteDoc(presenceRef);
      } catch (err) {
        console.warn('Error deleting presence on unload:', err);
      }
    };

    const handleUnload = () => {
      removePresence();
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    const sendHeartbeat = async () => {
      try {
        const presenceRef = doc(db, 'sessions', roomCode, 'presence', currentDeviceId);
        await setDoc(
          presenceRef,
          {
            deviceId: currentDeviceId,
            lastSeen: serverTimestamp(),
            joinedAt: serverTimestamp(),
            role: isHost ? 'host' : 'guest',
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Presence heartbeat error:', err);
      }

      if (!isCancelled) {
        // Adaptive heartbeat: 5s if searching/alone, 20s when connected to other devices
        const delayMs = connectedCountRef.current > 1 ? 20000 : 5000;
        timerId = setTimeout(sendHeartbeat, delayMs);
      }
    };

    const initSession = async () => {
      try {
        const roomRef = doc(db, 'sessions', roomCode);
        await setDoc(
          roomRef,
          {
            code: roomCode,
            lastUpdated: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Send initial heartbeat and start recursive loop
        await sendHeartbeat();
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };

    initSession();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      removePresence();
    };
  }, [roomCode, currentDeviceId, isHost, isAuthReady]);

  // 2. Presence Listener (Count active devices with 45s clock drift / latency tolerance)
  useEffect(() => {
    if (!isAuthReady) return;
    const presenceRef = collection(db, 'sessions', roomCode, 'presence');

    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        const nowMs = Date.now();
        let activeCount = 0;

        snapshot.docs.forEach((docSnap) => {
          // Current device is always active
          if (docSnap.id === currentDeviceId) {
            activeCount++;
            return;
          }

          const data = docSnap.data() as PresenceItem;
          if (data.lastSeen) {
            let lastSeenMs = nowMs;
            if (data.lastSeen instanceof Timestamp) {
              lastSeenMs = data.lastSeen.toMillis();
            } else if (typeof data.lastSeen === 'number') {
              lastSeenMs = data.lastSeen;
            } else if (typeof data.lastSeen?.toMillis === 'function') {
              lastSeenMs = data.lastSeen.toMillis();
            }

            // 45s threshold covers 20s heartbeat + network latency + clock drift between devices
            const diffMs = Math.abs(nowMs - lastSeenMs);
            const elapsedMs = nowMs - lastSeenMs;
            if (diffMs <= 45000 || elapsedMs <= 45000) {
              activeCount++;
            }
          } else {
            // New device with pending serverTimestamp
            activeCount++;
          }
        });

        setConnectedCount(Math.max(1, activeCount));
      },
      (error) => {
        console.warn('Presence snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [roomCode, isAuthReady, currentDeviceId]);

  // 3. Real-time Messages Listener
  useEffect(() => {
    if (!isAuthReady) return;
    const messagesQuery = query(
      collection(db, 'sessions', roomCode, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const list: MessageItem[] = [];
        snapshot.docs.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MessageItem, 'id'>),
          });
        });
        setMessages(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, `sessions/${roomCode}/messages`);
        } catch (err) {
          console.error('Handled messages snapshot error:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [roomCode, isAuthReady]);

  // 4. Real-time Room Files Listener
  useEffect(() => {
    if (!isAuthReady) return;
    const filesQuery = query(
      collection(db, 'sessions', roomCode, 'files'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const list: UploadedFileInfo[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          let uploadedAtIso = new Date().toISOString();
          if (data.uploadedAt instanceof Timestamp) {
            uploadedAtIso = data.uploadedAt.toDate().toISOString();
          } else if (typeof data.uploadedAt === 'string') {
            uploadedAtIso = data.uploadedAt;
          }

          const baseUrl = window.location.origin + window.location.pathname;
          const shareUrl = `${baseUrl}?code=${encodeURIComponent(roomCode)}`;

          list.push({
            id: docSnap.id,
            filePath: data.filePath,
            fileName: data.fileName,
            fileSize: data.fileSize || 0,
            fileType: data.fileType || 'Archivo',
            uploadedAt: uploadedAtIso,
            shareUrl,
            downloaded: Boolean(data.downloaded),
          });
        });
        setRoomFiles(list);
      },
      (error) => {
        console.warn('Room files snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [roomCode, isAuthReady]);

  // Auto-scroll on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Send Message
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    try {
      const messagesRef = collection(db, 'sessions', roomCode, 'messages');
      const newDocRef = doc(messagesRef);
      await setDoc(newDocRef, {
        id: newDocRef.id,
        text,
        senderId: currentDeviceId,
        role: isHost ? 'host' : 'guest',
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'sessions', roomCode),
        { lastUpdated: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sessions/${roomCode}/messages`);
    }
  };

  // Upload File Success -> Save to Firestore room subcollection
  const handleFileUploadSuccess = async (fileInfo: UploadedFileInfo) => {
    try {
      const fileRef = doc(db, 'sessions', roomCode, 'files', fileInfo.id);
      await setDoc(fileRef, {
        id: fileInfo.id,
        filePath: fileInfo.filePath,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileType: fileInfo.fileType,
        uploadedAt: serverTimestamp(),
        senderId: currentDeviceId,
        downloaded: false,
      });

      await setDoc(
        doc(db, 'sessions', roomCode),
        { lastUpdated: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('Error registering uploaded file in Firestore:', err);
    }
  };

  // Handle Item Downloaded -> Remove from Firestore subcollection
  const handleItemDownloaded = async (filePath: string, fileId: string) => {
    try {
      if (fileId) {
        await deleteDoc(doc(db, 'sessions', roomCode, 'files', fileId));
      }
    } catch (err) {
      console.error('Error removing file doc from room:', err);
    }
  };

  // Clear All Room Files
  const handleClearRoomFiles = async () => {
    try {
      const filesRef = collection(db, 'sessions', roomCode, 'files');
      const snapshot = await getDocs(filesRef);
      const deletePromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        if (data.filePath) {
          await deleteFileFromSupabase(data.filePath);
        }
        return deleteDoc(docSnap.ref);
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Error clearing room files:', err);
    }
  };

  // Copy Room Code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Copy Direct Link
  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(roomCode)}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Copy All Chat
  const handleCopyAllChat = async () => {
    if (messages.length === 0) return;
    try {
      const formatted = messages
        .map((m) => {
          const isSelf = m.senderId === currentDeviceId;
          const senderLabel = isSelf ? 'Tú' : 'Dispositivo ' + m.senderId.slice(-4);
          return `[${senderLabel}]: ${m.text}`;
        })
        .join('\n\n');

      await navigator.clipboard.writeText(formatted);
      setCopiedChat(true);
      setTimeout(() => setCopiedChat(false), 2000);
    } catch (err) {
      console.error('Failed to copy chat:', err);
    }
  };

  // Download .txt file
  const handleDownloadTxt = () => {
    if (messages.length === 0) return;

    const contentHeader = `--- TWINLINK SALA ${roomCode} ---\n` +
      `Fecha de exportación: ${new Date().toLocaleString()}\n` +
      `Total mensajes: ${messages.length}\n` +
      `---------------------------------------\n\n`;

    const contentBody = messages
      .map((m) => {
        const isSelf = m.senderId === currentDeviceId;
        const senderLabel = isSelf ? 'Tú' : 'Otro Dispositivo (' + m.senderId.slice(-4) + ')';
        let timeStr = '';
        if (m.createdAt) {
          if (m.createdAt instanceof Timestamp) {
            timeStr = m.createdAt.toDate().toLocaleTimeString();
          } else if (typeof m.createdAt?.toDate === 'function') {
            timeStr = m.createdAt.toDate().toLocaleTimeString();
          }
        }
        return `[${timeStr || 'En vivo'}] ${senderLabel}:\n${m.text}\n`;
      })
      .join('\n');

    const blob = new Blob([contentHeader + contentBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TwinLink_Chat_${roomCode.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear Chat
  const handleClearChat = async () => {
    setIsConfirmDeleteOpen(false);
    try {
      const messagesRef = collection(db, 'sessions', roomCode, 'messages');
      const snapshot = await getDocs(messagesRef);
      const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return 'Ahora';
    try {
      if (createdAt instanceof Timestamp) {
        return createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (typeof createdAt?.toDate === 'function') {
        return createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      return 'Ahora';
    }
    return 'Ahora';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Contenedor 1: Barra de Control de la Sala / App General */}
      <div className="bg-[#0b101d] border border-slate-800/90 rounded-2xl p-3 sm:px-6 sm:py-3.5 shadow-xl">
        {/* Version PC (md y superior) */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Left: Exit, Room Code */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-all border border-slate-700/60"
              title="Salir de la sala"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Salir</span>
            </button>

            {/* Room Code Badge */}
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition-all group"
              title="Copiar código de la sala"
            >
              <span className="text-xs font-mono font-bold text-cyan-400 group-hover:text-cyan-300 tracking-wider">
                {roomCode}
              </span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
              )}
            </button>
          </div>

          {/* Right: Live Presence Badge */}
          <div>
            {connectedCount > 1 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>En Vivo ({connectedCount})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/60 text-slate-400 rounded-full text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span>Offline (1)</span>
              </div>
            )}
          </div>
        </div>

        {/* Version Celular Móvil (debajo de md) */}
        <div className="grid md:hidden grid-cols-3 gap-2 w-full">
          <button
            onClick={handleExitRoom}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 active:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors"
            title="Salir de la sala"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Salir</span>
          </button>

          <button
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 active:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors group"
            title="Copiar código de la sala"
          >
            <span className="font-mono font-bold text-cyan-400 group-hover:text-cyan-300 tracking-wider">
              {roomCode}
            </span>
          </button>

          {connectedCount > 1 ? (
            <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>En Vivo</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded-xl">
              <span className="h-2 w-2 rounded-full bg-slate-500"></span>
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Contenedor 2: Panel de Manejo de Texto / Chat Box */}
      <div className="bg-[#0b101d] border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header Integrado del Panel de Texto */}
        <header className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              Panel de Texto
            </span>
          </div>

          {/* Acciones de Manejo de Texto (Copiar, Descargar, Borrar) */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
            <button
              onClick={handleCopyAllChat}
              disabled={messages.length === 0}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 active:bg-slate-700 disabled:opacity-40 border border-slate-700/60 rounded-xl transition-colors"
              title="Copiar todo el chat"
            >
              {copiedChat ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span>Copiar</span>
            </button>

            <button
              onClick={handleDownloadTxt}
              disabled={messages.length === 0}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 active:bg-slate-700 disabled:opacity-40 border border-slate-700/60 rounded-xl transition-colors"
              title="Descargar historial en .txt"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Descargar</span>
            </button>

            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={messages.length === 0}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-400 bg-slate-800/80 active:bg-slate-700 disabled:opacity-40 border border-slate-700/60 rounded-xl transition-colors"
              title="Borrar mensajes del chat"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Borrar</span>
            </button>
          </div>
        </header>

        {/* Chat Messages List */}
        <div
          ref={chatContainerRef}
          className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-950/60 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-cyan-400">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Sala Lista ({roomCode})</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Escribe un mensaje abajo o sube archivos más abajo para compartirlos en tiempo real con la sala.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.senderId === currentDeviceId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <span className="text-[10px] text-slate-400 font-mono px-1">
                    {isSelf ? 'Tú' : `Dispositivo ${msg.senderId.slice(-4)}`} • {formatMessageTime(msg.createdAt)}
                  </span>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] whitespace-pre-wrap break-words text-sm leading-relaxed ${
                      isSelf
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-2xl rounded-tl-xs px-4 py-3 shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Text Bar */}
        <footer className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800">
          <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 focus-within:border-cyan-500/60 rounded-2xl p-2 transition-colors">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe un mensaje o nota... (Enter para enviar, Shift+Enter para salto de línea)"
              rows={2}
              className="flex-1 bg-transparent border-0 resize-none text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none p-1.5 max-h-32"
            />

            <div className="flex items-center gap-1.5 pb-1 pr-1">
              {inputText && (
                <button
                  onClick={() => setInputText('')}
                  className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
                  title="Limpiar campo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-slate-950 rounded-xl transition-all font-semibold active:scale-95 shadow-md shadow-cyan-500/20"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Container 2: Integrated Shared Files for the Room */}
      <div className="space-y-6 pt-4 border-t border-slate-800/80">
        {/* File Uploader linked to Room */}
        <FileUploader
          onUploadSuccess={handleFileUploadSuccess}
          onOpenHelp={onOpenHelp}
        />

        {/* Synced Room Files List */}
        <HistoryList
          files={roomFiles}
          onClearHistory={handleClearRoomFiles}
          onItemDownloaded={handleItemDownloaded}
        />
      </div>

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomCode={roomCode}
      />

      {/* Modal Confirmación Borrar Chat */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b101d] border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">¿Borrar todo el chat?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta acción eliminará de forma permanente todos los mensajes de esta sala para todos los dispositivos conectados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-lg shadow-rose-600/20"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
