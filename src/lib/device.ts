const DEVICE_ID_KEY = 'twinlink_device_id';
const RECENT_CODES_KEY = 'twinlink_recent_codes';

/**
 * Generates a random 6-character room code formatted as "ABC 123"
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude easily confused chars (I, O, 0, 1)
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 3; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1} ${part2}`;
}

/**
 * Normalizes input room code (e.g., "abc123", "abc 123" -> "ABC 123")
 */
export function normalizeRoomCode(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) {
    return cleaned;
  }
  if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  // Trim to max 6 chars formatted as ABC 123
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}`;
}

/**
 * Gets or creates a unique device ID stored in localStorage
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const randomPart = Math.random().toString(36).substring(2, 10);
    const timePart = Date.now().toString(36);
    deviceId = `dev_${randomPart}_${timePart}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Returns recent room codes stored in localStorage
 */
export function getRecentCodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adds a room code to the top of recent history
 */
export function addRecentCode(code: string): void {
  const normalized = normalizeRoomCode(code);
  if (!normalized || normalized.length < 7) return;

  const current = getRecentCodes();
  const filtered = current.filter((c) => c !== normalized);
  const updated = [normalized, ...filtered].slice(0, 8); // Keep up to 8 recent codes

  try {
    localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save recent code:', err);
  }
}

/**
 * Removes a specific code from recent history
 */
export function removeRecentCode(code: string): void {
  const normalized = normalizeRoomCode(code);
  const current = getRecentCodes();
  const updated = current.filter((c) => c !== normalized && c !== code);
  try {
    localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not update recent codes:', err);
  }
}

/**
 * Clears all recent codes from history
 */
export function clearRecentCodes(): void {
  localStorage.removeItem(RECENT_CODES_KEY);
}
