import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if present
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const APP_CONFIG_DOC = doc(db, 'app_config', 'supabase');

export interface SupabaseConfigData {
  url: string;
  anonKey: string;
  updatedAt?: string;
}

/**
 * Fetch initial Supabase credentials stored globally in Firestore
 */
export async function fetchFirestoreSupabaseCredentials(): Promise<SupabaseConfigData | null> {
  try {
    const snapshot = await getDoc(APP_CONFIG_DOC);
    if (snapshot.exists()) {
      const data = snapshot.data() as SupabaseConfigData;
      if (data.url && data.anonKey) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Error fetching Supabase credentials from Firestore:', error);
  }
  return null;
}

/**
 * Save Supabase credentials globally to Firestore
 */
export async function saveFirestoreSupabaseCredentials(url: string, anonKey: string): Promise<boolean> {
  try {
    await setDoc(APP_CONFIG_DOC, {
      url: url.trim(),
      anonKey: anonKey.trim(),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error saving Supabase credentials to Firestore:', error);
    return false;
  }
}

/**
 * Subscribe to real-time changes in Supabase credentials in Firestore
 */
export function subscribeToFirestoreSupabaseCredentials(
  callback: (data: SupabaseConfigData | null) => void
): () => void {
  return onSnapshot(
    APP_CONFIG_DOC,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SupabaseConfigData;
        if (data.url && data.anonKey) {
          callback(data);
          return;
        }
      }
      callback(null);
    },
    (error) => {
      console.warn('Firestore subscription error:', error);
      callback(null);
    }
  );
}
