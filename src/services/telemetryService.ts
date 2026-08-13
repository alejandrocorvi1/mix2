import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';

const FIVE_GB_BYTES = 5 * 1024 * 1024 * 1024; // 5.0 GB = 5,368,709,120 bytes
const CYCLE_RESET_DAY = 10; // Renovación mensual los días 10 de cada mes

/**
 * Calcula la fecha UTC de inicio del ciclo activo actual (Día 10 a las 00:00:00 UTC)
 */
export function getCurrentPeriodStartDate(now: Date = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const day = now.getUTCDate();

  let cycleStart: Date;

  if (day >= CYCLE_RESET_DAY) {
    cycleStart = new Date(Date.UTC(year, month, CYCLE_RESET_DAY, 0, 0, 0, 0));
  } else {
    cycleStart = new Date(Date.UTC(year, month - 1, CYCLE_RESET_DAY, 0, 0, 0, 0));
  }

  return cycleStart;
}

/**
 * Verifica si ha transcurrido el día 10 de un nuevo ciclo mensual respecto a la fecha guardada
 * y reinicia el contador de bytes a 0 en Firestore de forma atómica.
 */
export async function checkAndResetMonthlyCycle(): Promise<void> {
  try {
    const docRef = doc(db, 'telemetry', 'supabase_egress');
    const expectedCycleStart = getCurrentPeriodStartDate();

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);

      if (!docSnap.exists()) {
        transaction.set(docRef, {
          bytesUsed: 0,
          cycleDay: CYCLE_RESET_DAY,
          currentPeriodStart: expectedCycleStart.toISOString(),
          lastUpdated: serverTimestamp()
        });
        return;
      }

      const data = docSnap.data();
      const storedPeriodStart = data.currentPeriodStart ? new Date(data.currentPeriodStart) : new Date(0);

      // Si el período guardado es anterior al inicio del ciclo activo actual, se reinicia
      if (storedPeriodStart.getTime() < expectedCycleStart.getTime()) {
        transaction.update(docRef, {
          bytesUsed: 0,
          currentPeriodStart: expectedCycleStart.toISOString(),
          lastUpdated: serverTimestamp()
        });
      }
    });
  } catch (err) {
    console.warn('Error verificando reinicio de ciclo mensual en Firestore:', err);
  }
}

/**
 * Registra de manera atómica el tamaño de los bytes descargados (blob.size) en Firestore usando increment()
 */
export async function recordEgressBytes(bytes: number): Promise<void> {
  if (bytes <= 0) return;

  const docRef = doc(db, 'telemetry', 'supabase_egress');

  try {
    await checkAndResetMonthlyCycle();

    await updateDoc(docRef, {
      bytesUsed: increment(bytes),
      lastUpdated: serverTimestamp()
    });
  } catch (err) {
    // Si el documento no existe aún, se inicializa
    const expectedCycleStart = getCurrentPeriodStartDate();
    await setDoc(docRef, {
      bytesUsed: bytes,
      cycleDay: CYCLE_RESET_DAY,
      currentPeriodStart: expectedCycleStart.toISOString(),
      lastUpdated: serverTimestamp()
    }, { merge: true });
  }
}

/**
 * Consulta el contador global de bytes en Firestore y calcula el porcentaje consumido sobre los 5.0 GB
 */
export async function getEgressUsageFromFirestore(): Promise<{
  success: boolean;
  percentage: number;
  usedGb: number;
  totalGb: number;
  bytesUsed: number;
  error?: string;
}> {
  try {
    await checkAndResetMonthlyCycle();

    const docRef = doc(db, 'telemetry', 'supabase_egress');
    const docSnap = await getDoc(docRef);

    let bytesUsed = 0;
    if (docSnap.exists()) {
      bytesUsed = docSnap.data().bytesUsed || 0;
    }

    const usedGb = bytesUsed / (1024 * 1024 * 1024);
    const totalGb = 5.0;
    const percentage = Math.min(100, (bytesUsed / FIVE_GB_BYTES) * 100);

    return {
      success: true,
      percentage: Number(percentage.toFixed(2)),
      usedGb: Number(usedGb.toFixed(4)),
      totalGb,
      bytesUsed
    };
  } catch (err: any) {
    console.error('Error al obtener uso de Egress desde Firestore:', err);
    return {
      success: false,
      percentage: 0,
      usedGb: 0,
      totalGb: 5.0,
      bytesUsed: 0,
      error: err?.message || 'Error al consultar la telemetría en Firestore'
    };
  }
}
