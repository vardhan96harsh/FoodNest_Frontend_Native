// lib/api.ts
import { API_BASE_URL } from "@/constants/env";
import { getToken, bootstrapAuth } from "./authStore";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // Ensure auth is bootstrapped before making the request
  await bootstrapAuth();
  
  // AWAIT the token since it's now async
  const token = await getToken();
  console.log("Token after bootstrap:", token ? "Present (length: " + token.length + ")" : "Missing");
  
  // Debug: Log first few chars of token (safe)
  if (token) {
    console.log("Token starts with:", token.substring(0, 15) + "...");
  }
  
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  
  console.log(`Fetching: ${API_BASE_URL}${path}`);
  
  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  
  if (!res.ok) {
    console.error("API Error:", {
      status: res.status,
      statusText: res.statusText,
      data: data
    });
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { 
    method: "POST", 
    body: body ? JSON.stringify(body) : undefined 
  }),
  patch: <T>(path: string, body?: any) => request<T>(path, { 
    method: "PATCH", 
    body: body ? JSON.stringify(body) : undefined 
  }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};