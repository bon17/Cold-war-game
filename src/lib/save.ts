// 이름별 기록 저장(기획서 5.9). 브라우저 저장소(localStorage)에만 두고 어디로도 보내지 않는다.
// 저장은 모두 try/catch로 감싸고, 실패해도 게임은 계속된다.
import type { SaveSlot } from '../types';

export const SAVE_KEY = 'needle-and-thread:v1';
export const MAX_SLOTS = 40;
export const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;   // 60일

// 앞뒤 공백은 빼고 비교한다(예: ' 2-12-김민수 ' = '2-12-김민수')
export function normalizeName(name: string): string {
  return name.trim();
}

// 기록이 40개를 넘거나 마지막 저장 뒤 60일이 지나면 오래된 것부터 지운다
export function prune(slots: SaveSlot[], now: number): SaveSlot[] {
  return slots
    .filter((s) => now - s.updatedAt <= MAX_AGE_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SLOTS);
}

export function readSlots(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): SaveSlot[] {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { slots?: SaveSlot[] };
    return Array.isArray(data.slots) ? data.slots : [];
  } catch {
    return [];
  }
}

function writeSlots(slots: SaveSlot[], storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): boolean {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify({ slots }));
    return true;
  } catch {
    return false;
  }
}

export function findSlot(name: string, storage?: Pick<Storage, 'getItem'>): SaveSlot | undefined {
  const key = normalizeName(name);
  return readSlots(storage).find((s) => s.name === key);
}

export function saveSlot(slot: SaveSlot, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safeStorage(), now = Date.now()): boolean {
  const others = readSlots(storage).filter((s) => s.name !== slot.name);
  return writeSlots(prune([{ ...slot, updatedAt: now }, ...others], now), storage);
}

export function deleteSlot(name: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safeStorage()): boolean {
  const key = normalizeName(name);
  return writeSlots(readSlots(storage).filter((s) => s.name !== key), storage);
}

// 개인 창이나 저장이 막힌 브라우저에서는 localStorage에 손대기만 해도 오류가 날 수 있다
function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
