/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Configuración de nodo de datos predeterminado
// ============================================================================
export const CORE_NODE_ENDPOINT = "https://lzozhhcoxvlqnoufgdcz.supabase.co";
export const CORE_APP_SIGNATURE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6b3poaGNveHZscW5vdWZnZGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzc1MDYsImV4cCI6MjEwMTU1MzUwNn0.tomO4bbCcvowOLhZTb2deNlwzLUG17WtDsposEarVR8";

export const SUPABASE_URL = CORE_NODE_ENDPOINT;
export const SUPABASE_ANON_KEY = CORE_APP_SIGNATURE;
// ============================================================================

const BUCKET_NAME = 'temp-files';

let inMemoryUrl: string | null = null;
let inMemoryKey: string | null = null;

export function updateGlobalCredentials(url: string | null, anonKey: string | null) {
  inMemoryUrl = url;
  inMemoryKey = anonKey;

  if (url && anonKey) {
    localStorage.setItem('TEMPFILES_SUPABASE_URL', url);
    localStorage.setItem('TEMPFILES_SUPABASE_ANON_KEY', anonKey);
  } else {
    localStorage.removeItem('TEMPFILES_SUPABASE_URL');
    localStorage.removeItem('TEMPFILES_SUPABASE_ANON_KEY');
  }

  resetSupabaseClient();
}

// Obtener las credenciales activas (ya sean de Firestore/inMemory, localStorage o env)
export function getActiveCredentials() {
  const savedUrl = localStorage.getItem('TEMPFILES_SUPABASE_URL');
  const savedKey = localStorage.getItem('TEMPFILES_SUPABASE_ANON_KEY');

  const url = inMemoryUrl || savedUrl || import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
  const anonKey = inMemoryKey || savedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

  const isConfigured = Boolean(
    url && 
    anonKey && 
    url !== "https://tu-proyecto.supabase.co" && 
    anonKey !== "tu-supabase-anon-key-aqui" &&
    url.includes('supabase.co')
  );

  return { url, anonKey, isConfigured };
}

// Instancia de Supabase Client
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getActiveCredentials();
  
  if (!isConfigured) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(url, anonKey);
  }
  return clientInstance;
}

export function resetSupabaseClient() {
  clientInstance = null;
}

// Simulación local para almacenamiento temporal cuando se está en modo prueba/demo
const mockStorage = new Map<string, { file: File; uploadedAt: string }>();

/**
 * Intenta crear el bucket "temp-files" en Supabase Storage si no existe aún.
 */
export async function tryCreateTempFilesBucket(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase no está configurado (modo placeholder activo).' };
  }

  try {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 104857600, // 100MB
    });

    if (error) {
      if (
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('duplicate')
      ) {
        return { success: true, message: 'El bucket "temp-files" ya existe en Supabase.' };
      }
      console.warn('No se pudo crear automáticamente el bucket:', error.message);
      return {
        success: false,
        message: `No se pudo crear el bucket automáticamente (${error.message}). Por favor crea el bucket "temp-files" manualmente en tu panel de Supabase.`
      };
    }

    return { success: true, message: '¡Bucket "temp-files" creado exitosamente en Supabase Storage!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al intentar crear el bucket' };
  }
}

/**
 * REQUISITO 1: Subir un archivo al bucket "temp-files" de Supabase Storage.
 */
export async function uploadToSupabaseBucket(file: File): Promise<{
  success: boolean;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  error?: string;
  isBucketError?: boolean;
  isRlsError?: boolean;
  isSimulated?: boolean;
}> {
  const fileExt = file.name.split('.').pop() || '';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${timestamp}_${randomId}_${cleanFileName}`;

  const supabase = getSupabaseClient();

  if (!supabase) {
    // Modo simulación local cuando se usan los placeholders por defecto
    console.log('[Demo Mode] Guardando archivo localmente para prueba de UI...');
    mockStorage.set(filePath, {
      file,
      uploadedAt: new Date().toISOString()
    });

    return {
      success: true,
      filePath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      isSimulated: true
    };
  }

  try {
    let { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    // Si el error es "Bucket not found", intentar crearlo automáticamente en Supabase y reintentar
    if (
      error &&
      (error.message.toLowerCase().includes('bucket not found') ||
       (error as any).statusCode === '404' ||
       (error as any).statusCode === 404)
    ) {
      console.log('Bucket "temp-files" no encontrado. Intentando crear automáticamente...');
      const createRes = await tryCreateTempFilesBucket();
      if (createRes.success) {
        // Reintentar la subida
        const retryResult = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        data = retryResult.data;
        error = retryResult.error;
      }
    }

    if (error) {
      console.error('Error al subir a Supabase Storage:', error);
      const isBucketError =
        error.message.toLowerCase().includes('bucket not found') ||
        (error as any).statusCode === '404' ||
        (error as any).statusCode === 404;

      const isRlsError =
        error.message.toLowerCase().includes('violates row-level security policy') ||
        error.message.toLowerCase().includes('row-level security') ||
        error.message.toLowerCase().includes('rls');

      let customErrorMessage = error.message;
      if (isBucketError) {
        customErrorMessage = 'El bucket "temp-files" no existe en tu proyecto de Supabase Storage. Haz clic abajo para crearlo o agrégalo en tu panel de Supabase.';
      } else if (isRlsError) {
        customErrorMessage = 'Tu bucket "temp-files" en Supabase tiene activado Row-Level Security (RLS) sin permisos para usuarios anónimos (anon). Copia y ejecuta las políticas SQL en tu panel de Supabase.';
      }

      return {
        success: false,
        filePath: '',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: customErrorMessage,
        isBucketError,
        isRlsError
      };
    }

    return {
      success: true,
      filePath: data.path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      isSimulated: false
    };
  } catch (err: any) {
    console.error('Excepción al subir a Supabase:', err);
    let errMsg = err?.message || 'Error de conexión con Supabase';
    if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror')) {
      errMsg = 'No se pudo conectar con el servidor de Supabase (Failed to fetch). Revisa que la URL y la Clave Anónima (Anon Key) en "Configurar Credenciales" sean correctas y que la URL incluya https://.';
    }
    return {
      success: false,
      filePath: '',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      error: errMsg
    };
  }
}

/**
 * REQUISITO 3:
 * Descargar el archivo para guardarlo en el dispositivo del usuario
 * e INMEDIATAMENTE eliminarlo del bucket de Supabase usando el método remove().
 */
export async function downloadAndRemoveFromSupabase(
  filePath: string,
  fileName: string
): Promise<{
  success: boolean;
  blob?: Blob;
  error?: string;
  isSimulated?: boolean;
}> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    // Modo simulación local
    const mockData = mockStorage.get(filePath);
    if (!mockData) {
      return {
        success: false,
        error: 'El archivo ya no existe en el almacenamiento temporal o ya fue autodestruido.'
      };
    }

    // Convertir File a Blob
    const blob = new Blob([mockData.file], { type: mockData.file.type });

    // REQUISITO 3: Eliminar inmediatamente
    mockStorage.delete(filePath);

    return {
      success: true,
      blob,
      isSimulated: true
    };
  }

  try {
    // 1. Descargar el archivo desde el bucket "temp-files"
    const { data: blobData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (downloadError) {
      console.error('Error al descargar de Supabase Storage:', downloadError);
      return {
        success: false,
        error: `No se pudo descargar el archivo: ${downloadError.message}. Es posible que ya haya sido eliminado.`
      };
    }

    if (!blobData) {
      return {
        success: false,
        error: 'El archivo descargado está vacío o no fue encontrado.'
      };
    }

    // 2. REQUISITO 3: Eliminar inmediatamente el archivo del bucket de Supabase usando remove()
    const { error: removeError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (removeError) {
      console.warn('Advertencia: El archivo se descargó pero falló la eliminación con remove():', removeError.message);
    } else {
      console.log(`✅ Archivo '${filePath}' eliminado exitosamente de Supabase Storage con remove()`);
    }

    return {
      success: true,
      blob: blobData,
      isSimulated: false
    };
  } catch (err: any) {
    console.error('Excepción al procesar descarga y autodestrucción:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al conectar con Supabase Storage'
    };
  }
}

/**
 * Obtener la URL pública directa del archivo en Supabase Storage
 */
export function getSupabasePublicUrl(filePath: string): string {
  const active = getActiveCredentials();
  if (!active.url) return '';
  const cleanUrl = active.url.replace(/\/+$/, '');
  return `${cleanUrl}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
}

/**
 * Elimina directamente un archivo de Supabase Storage mediante remove()
 */
export async function deleteFileFromSupabase(filePath: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    mockStorage.delete(filePath);
    return true;
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.warn('Error al eliminar archivo de Supabase Storage:', error.message);
      return false;
    }
    console.log(`✅ Archivo '${filePath}' autodestruido/eliminado de Supabase Storage`);
    return true;
  } catch (err) {
    console.error('Excepción al eliminar archivo de Supabase:', err);
    return false;
  }
}

/**
 * Tiempo de expiración automática: 4 minutos (240.000 ms)
 */
export const EXPIRATION_TIME_MS = 4 * 60 * 1000;

/**
 * Calcula el tiempo restante antes de la autodestrucción de 4 minutos
 */
export function getTimeRemaining(uploadedAtISO: string): {
  remainingSeconds: number;
  isExpired: boolean;
  formattedTime: string;
} {
  let uploadTime = new Date(uploadedAtISO).getTime();
  
  // Si no se puede parsear directamente (por ejemplo si venía en formato de hora corto "10:30"), fallback a tiempo actual
  if (isNaN(uploadTime)) {
    uploadTime = Date.now();
  }

  const now = Date.now();
  const elapsed = now - uploadTime;
  const remainingMs = EXPIRATION_TIME_MS - elapsed;

  if (remainingMs <= 0) {
    return { remainingSeconds: 0, isExpired: true, formattedTime: '00:00' };
  }

  const remainingSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { remainingSeconds, isExpired: false, formattedTime };
}

/**
 * Función para verificar la existencia de un archivo sin descargarlo completamente
 */
export async function checkFileExistsInSupabase(filePath: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return mockStorage.has(filePath);
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 100,
        search: filePath
      });

    if (error || !data) return false;
    return data.some(item => item.name === filePath);
  } catch {
    return false;
  }
}
