import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const db: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, databaseId);

export const auth: Auth = getAuth(app);

// Ensure anonymous authentication on startup
let authInitPromise: Promise<any> | null = null;

export function ensureAnonymousAuth(): Promise<any> {
  if (!authInitPromise) {
    authInitPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        } else {
          signInAnonymously(auth)
            .then((cred) => {
              unsubscribe();
              resolve(cred.user);
            })
            .catch((err) => {
              console.warn('Anonymous auth error:', err);
              unsubscribe();
              resolve(null);
            });
        }
      });
    });
  }
  return authInitPromise;
}

// Immediately trigger auth check
ensureAnonymousAuth();

// Connection check
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'app_config', 'test_connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn('Firestore connectivity check: client offline or long polling active.');
    }
  }
}

// Standard Firestore Error Handler for diagnosis
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
