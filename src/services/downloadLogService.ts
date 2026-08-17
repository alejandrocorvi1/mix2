import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GlobalDownloadRecord {
  id?: string;
  fecha: string;
  hora: string;
  roomCode: string;
  device: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileSizeFormatted: string;
  timestamp: number;
  createdAt?: any;
}

/**
 * Detecta el tipo y sistema operativo del dispositivo del usuario
 */
export function getDeviceDescription(): string {
  if (typeof window === 'undefined' || !navigator) return 'Dispositivo Desconocido';

  const ua = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  let deviceType = 'PC';
  let os = 'Desconocido';

  if (/iPad|tablet/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    deviceType = 'Tablet';
    os = 'iPadOS';
  } else if (/iPhone|iPod/i.test(ua)) {
    deviceType = 'Móvil';
    os = 'iOS (iPhone)';
  } else if (/Android/i.test(ua)) {
    deviceType = /Mobile/i.test(ua) ? 'Móvil' : 'Tablet';
    os = 'Android';
  } else if (/Windows/i.test(ua) || /Win/i.test(platform)) {
    deviceType = 'PC';
    os = 'Windows';
  } else if (/Mac/i.test(ua) || /Mac/i.test(platform)) {
    deviceType = 'PC';
    os = 'macOS';
  } else if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
    deviceType = 'PC';
    os = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    deviceType = 'PC';
    os = 'ChromeOS';
  }

  // Detectar navegador principal
  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  return `${deviceType} (${os}${browser ? ` - ${browser}` : ''})`;
}

/**
 * Formatea el tamaño en bytes a un formato legible
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formatted} ${sizes[i]}`;
}

/**
 * Registra una descarga global en Firestore para todas las salas
 */
export async function recordGlobalDownload(params: {
  fileName: string;
  filePath: string;
  fileSize: number;
  roomCode?: string;
  device?: string;
}): Promise<void> {
  try {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hora = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const roomCode = (params.roomCode && params.roomCode.trim())
      ? params.roomCode.trim()
      : (localStorage.getItem('twinlink_active_room') || 'Sin código / Enlace Directo');

    const device = params.device || getDeviceDescription();
    const fileSize = params.fileSize || 0;
    const fileSizeFormatted = formatBytes(fileSize);

    const docData: GlobalDownloadRecord = {
      fecha,
      hora,
      roomCode,
      device,
      fileName: params.fileName,
      filePath: params.filePath,
      fileSize,
      fileSizeFormatted,
      timestamp: now.getTime(),
      createdAt: serverTimestamp()
    };

    const colRef = collection(db, 'global_downloads');
    await addDoc(colRef, docData);
    console.log(`[Global Download Logger] Registrada descarga de "${params.fileName}" en sala "${roomCode}"`);
  } catch (error) {
    console.warn('[Global Download Logger] Error registrando descarga en Firestore:', error);
  }
}

/**
 * Obtiene el historial global de todas las descargas realizadas en todas las salas
 */
export async function getGlobalDownloadsList(maxItems: number = 2000): Promise<GlobalDownloadRecord[]> {
  try {
    const colRef = collection(db, 'global_downloads');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxItems));
    const snapshot = await getDocs(q);

    const records: GlobalDownloadRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      records.push({
        id: docSnap.id,
        fecha: data.fecha || 'N/A',
        hora: data.hora || 'N/A',
        roomCode: data.roomCode || 'Desconocida',
        device: data.device || 'Desconocido',
        fileName: data.fileName || 'Archivo sin nombre',
        filePath: data.filePath || '',
        fileSize: data.fileSize || 0,
        fileSizeFormatted: data.fileSizeFormatted || formatBytes(data.fileSize || 0),
        timestamp: data.timestamp || 0
      });
    });

    return records;
  } catch (error) {
    console.error('[Global Download Logger] Error consultando descargas globales:', error);
    return [];
  }
}

/**
 * Obtiene la cantidad total de descargas globales registradas
 */
export async function getGlobalDownloadsCount(): Promise<number> {
  try {
    const colRef = collection(db, 'global_downloads');
    const snapshot = await getDocs(colRef);
    return snapshot.size;
  } catch (error) {
    console.warn('[Global Download Logger] Error al obtener contador de descargas:', error);
    return 0;
  }
}

/**
 * Genera el contenido formateado del archivo .txt con todos los datos requeridos
 */
export function generateGlobalDownloadsTxtContent(records: GlobalDownloadRecord[]): string {
  const now = new Date();
  const fechaGeneracion = now.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const horaGeneracion = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let txt = `================================================================================\n`;
  txt += `           REGISTRO GLOBAL DE DESCARGAS - TWINLINK & SUPABASE STORAGE\n`;
  txt += `================================================================================\n`;
  txt += `Fecha de Generación: ${fechaGeneracion} a las ${horaGeneracion}\n`;
  txt += `Total de descargas registradas en todas las salas: ${records.length}\n`;
  txt += `================================================================================\n\n`;

  if (records.length === 0) {
    txt += `No hay registros de descargas acumulados en el sistema hasta el momento.\n`;
    return txt;
  }

  records.forEach((item, index) => {
    txt += `[DESCARGA #${index + 1}]\n`;
    txt += `• Fecha: ${item.fecha}\n`;
    txt += `• Hora: ${item.hora}\n`;
    txt += `• Código de sala: ${item.roomCode}\n`;
    txt += `• Dispositivo: ${item.device}\n`;
    txt += `• Archivo: ${item.fileName}\n`;
    txt += `• Tamaño: ${item.fileSizeFormatted} (${item.fileSize.toLocaleString('es-ES')} bytes)\n`;
    txt += `--------------------------------------------------------------------------------\n`;
  });

  txt += `\nFin del registro global.\n`;
  return txt;
}

/**
 * Descarga directamente el archivo .txt en el navegador del usuario
 */
export async function downloadGlobalDownloadsTxtFile(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const records = await getGlobalDownloadsList();
    const content = generateGlobalDownloadsTxtContent(records);

    // Añadir UTF-8 BOM para apertura perfecta en cualquier bloc de notas / editor de texto
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `Registro_Global_Descargas_TwinLink_${dateStamp}_${timeStamp}.txt`;

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);

    return { success: true, count: records.length };
  } catch (error: any) {
    console.error('Error al exportar .txt de descargas globales:', error);
    return { success: false, count: 0, error: error?.message || 'Error al generar el archivo .txt' };
  }
}

/**
 * Elimina todos los registros de descargas globales de Firestore
 */
export async function clearAllGlobalDownloads(): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const colRef = collection(db, 'global_downloads');
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      return { success: true, deletedCount: 0 };
    }

    // Usar batches de Firestore (máximo 500 por lote)
    const docs = snapshot.docs;
    const batchSize = 450;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deletedCount += chunk.length;
    }

    console.log(`[Global Download Logger] Eliminados exitosamente ${deletedCount} registros globales.`);
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('Error al eliminar registros globales de Firestore:', error);
    return { success: false, deletedCount: 0, error: error?.message || 'Error al eliminar registros' };
  }
}
