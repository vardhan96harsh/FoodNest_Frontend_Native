// lib/authStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

type Role = "superadmin" | "rider" | "cook" | "supervisor" | "refill";
export interface AuthUser { 
  _id?: string;
  email: string; 
  name?: string; 
  role: Role;
}
interface AuthSession { user: AuthUser; token: string; }

const listeners = new Set<() => void>();
let session: AuthSession | null = null;
let pendingData: { email: string; name: string } | null = null;

const KEY_TOKEN   = "auth.token";
const KEY_USER    = "auth.user";
const KEY_PENDING = "auth.pending";

function notify() { for (const cb of Array.from(listeners)) try { cb(); } catch {} }

export function onAuthChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getUser()    { return session?.user  ?? null; }
export function getToken()   { return session?.token ?? null; }
export function getPending() { return pendingData; }

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
      console.log("✅ Auth bootstrapped with user:", user.email);
      notify();
    } catch { 
      await clearAuth(); 
    }
  } else {
    console.log("⚠️ No existing auth session found");
  }

  if (rawPending) {
    try {
      pendingData = JSON.parse(rawPending);
      notify();
    } catch {}
  }
}

export async function signInWithToken(user: AuthUser, token: string) {
  console.log("🔐 Signing in with token, user:", user.email);
  session = { user, token };
  pendingData = null;
  await Promise.all([
    AsyncStorage.setItem(KEY_TOKEN, token),
    AsyncStorage.setItem(KEY_USER, JSON.stringify(user)),
    AsyncStorage.removeItem(KEY_PENDING),
  ]);
  notify();
  console.log("✅ Sign in successful");
}

export async function signInPending(email: string, name: string) {
  console.log("⏳ Setting pending sign in for:", email);
  pendingData = { email, name };
  session = null;
  await Promise.all([
    AsyncStorage.setItem(KEY_PENDING, JSON.stringify({ email, name })),
    AsyncStorage.removeItem(KEY_TOKEN),
    AsyncStorage.removeItem(KEY_USER),
  ]);
  notify();
}

export async function signOut() {
  console.log("🚪 Signing out");
  await clearAuth();
  try { await WebBrowser.coolDownAsync(); } catch {}
  notify();
}

async function clearAuth() {
  session     = null;
  pendingData = null;
  await AsyncStorage.multiRemove([
    KEY_TOKEN, KEY_USER, KEY_PENDING,
  ]);
}

export function getAuthState() {
  return {
    isAuthenticated: !!session?.token && session.token.length > 0,
    user: session?.user || null,
    hasToken: !!session?.token,
    tokenLength: session?.token?.length || 0,
    pendingData: pendingData
  };
}

export async function debugStorage() {
  const keys = [KEY_TOKEN, KEY_USER, KEY_PENDING];
  console.log("=== Storage Debug ===");
  for (const key of keys) {
    const value = await AsyncStorage.getItem(key);
    if (value) {
      if (key.includes('token')) {
        console.log(`${key}: ${value.substring(0, 30)}... (${value.length} chars)`);
      } else {
        console.log(`${key}: ${JSON.stringify(JSON.parse(value))}`);
      }
    } else {
      console.log(`${key}: not set`);
    }
  }
  console.log("====================");
}