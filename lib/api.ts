// lib/api.ts
import { API_BASE_URL } from "@/constants/env";
import { getToken, bootstrapAuth, getAuthState, signOut } from "./authStore";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // Ensure auth is bootstrapped before making the request
  await bootstrapAuth();
  
  // Get auth state for debugging
  const authState = getAuthState();
  console.log(`\n🔵 API Request: ${path}`);
  console.log(`Authenticated: ${authState.isAuthenticated}`);
  console.log(`Has token: ${authState.hasToken}`);
  console.log(`Token length: ${authState.tokenLength}`);
  
  // Get the token
  const token = await getToken();
  
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  
  // Only add Authorization header if token exists and is not empty
  if (token && token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
    console.log(`✅ Adding Authorization header (token length: ${token.length})`);
  } else {
    console.warn(`⚠️ No valid token for request to ${path}`);
  }
  
  console.log(`🌐 Fetching: ${API_BASE_URL}${path}`);
  
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
    const text = await res.text();
    let data: any = null;
    
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    
    console.log(`📥 Response status: ${res.status}`);
    
    if (!res.ok) {
      console.error(`❌ API Error for ${path}:`, {
        status: res.status,
        statusText: res.statusText,
        data: data
      });
      
      // Handle 401 specifically - token might be invalid or expired
      if (res.status === 401) {
        console.error("🔐 Authentication failed - token may be invalid or expired");
        // Optionally trigger logout
        // await signOut();
      }
      
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    
    console.log(`✅ Request successful: ${path}`);
    return data as T;
  } catch (error) {
    console.error(`💥 Network/Request error for ${path}:`, error);
    throw error;
  }
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