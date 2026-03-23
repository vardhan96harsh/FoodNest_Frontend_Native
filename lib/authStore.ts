import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

type Role = "superadmin" | "rider" | "cook" | "supervisor" | "refill";
export interface AuthUser { email: string; name?: string; role: Role; }
interface AuthSession { user: AuthUser; token: string; }

const listeners = new Set<() => void>();
let session: AuthSession | null = null;
let pendingData: { email: string; name: string } | null = null; // ← NEW

const KEY_TOKEN   = "auth.token";
const KEY_USER    = "auth.user";
const KEY_PENDING = "auth.pending"; // ← NEW

function notify() { for (const cb of Array.from(listeners)) try { cb(); } catch {} }

export function onAuthChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getUser()    { return session?.user  ?? null; }
export function getToken()   { return session?.token ?? null; }
export function getPending() { return pendingData; } // ← NEW

export async function bootstrapAuth() {
  const [token, rawUser, rawPending] = await Promise.all([
    AsyncStorage.getItem(KEY_TOKEN),
    AsyncStorage.getItem(KEY_USER),
    AsyncStorage.getItem(KEY_PENDING),
  ]);

  if (token && rawUser) {
    try {
      const user = JSON.parse(rawUser) as AuthUser;
      session = { user, token };
      notify();
    } catch { await clearAuth(); }
  }

  if (rawPending) {
    try {
      pendingData = JSON.parse(rawPending);
      notify();
    } catch {}
  }
}

export async function signInWithToken(user: AuthUser, token: string) {
  session = { user, token };
  pendingData = null;
  await Promise.all([
    AsyncStorage.setItem(KEY_TOKEN, token),
    AsyncStorage.setItem(KEY_USER, JSON.stringify(user)),
    AsyncStorage.removeItem(KEY_PENDING),
  ]);
  notify();
}

// ← NEW: save pending state
export async function signInPending(email: string, name: string) {
  pendingData = { email, name };
  session = null;
  await Promise.all([
    AsyncStorage.setItem(KEY_PENDING, JSON.stringify({ email, name })),
    AsyncStorage.removeItem(KEY_TOKEN),
    AsyncStorage.removeItem(KEY_USER),
    AsyncStorage.removeItem("token"),
    AsyncStorage.removeItem("user"),
    AsyncStorage.removeItem("role"),
    AsyncStorage.removeItem("userId"),
  ]);
  notify();
}

export async function signOut() {
  await clearAuth();
  try { await WebBrowser.coolDownAsync(); } catch {}
  notify();
}

async function clearAuth() {
  session     = null;
  pendingData = null;
  await AsyncStorage.multiRemove([
    KEY_TOKEN, KEY_USER, KEY_PENDING,
    "token", "user", "role", "userId",
  ]);
}

export async function signIn(user: AuthUser) {
  await signInWithToken(user, "");
}