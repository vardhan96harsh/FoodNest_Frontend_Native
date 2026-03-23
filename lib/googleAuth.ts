import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_BASE_URL } from "@/constants/env";
import { signInWithToken, signInPending } from "@/lib/authStore";

WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthResult =
  | { success: true }
  | { success: true; pending: true }
  | { success: false; error: string };

export async function loginWithGoogle(): Promise<GoogleAuthResult> {
  try {
    const loginUrl    = `${API_BASE_URL}/api/auth/auth0/login`;
    const redirectUri = "foodnestnative://auth/callback";

    const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);

    if (result.type === "cancel" || result.type === "dismiss") {
      return { success: false, error: "Login cancelled" };
    }

    if (result.type === "success") {
      const { queryParams } = Linking.parse(result.url);
      const status = queryParams?.status as string;

      if (status === "pending") {
        const name  = decodeURIComponent(queryParams?.name  as string || "");
        const email = decodeURIComponent(queryParams?.email as string || "");
        // Save pending state — index.tsx will redirect to pending screen
        await signInPending(email, name);
        return { success: true, pending: true };
      }

      if (status === "approved") {
        const token   = queryParams?.token   as string;
        const userRaw = queryParams?.user    as string;
        const user    = JSON.parse(decodeURIComponent(userRaw));
        await signInWithToken(user, token);
        return { success: true };
      }
    }

    return { success: false, error: "Login failed" };
  } catch (e: any) {
    return { success: false, error: e?.message || "Something went wrong" };
  }
}