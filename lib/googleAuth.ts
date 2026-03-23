import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_BASE_URL } from "@/constants/env";
import { signInWithToken } from "@/lib/authStore";

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  success: boolean;
  error?: string;
}

const googleAuth = {
  async loginWithGoogle(): Promise<GoogleAuthResult> {
    try {
      const loginUrl = `${API_BASE_URL}/api/auth/auth0/login`;
      const redirectUri = Linking.createURL("/auth/callback");

      const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);

      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false, error: "Login cancelled" };
      }

      if (result.type === "success") {
        const { queryParams } = Linking.parse(result.url);
        const token = queryParams?.token as string;
        const userRaw = queryParams?.user as string;

        if (!token || !userRaw) {
          return { success: false, error: "Invalid response from server" };
        }

        const user = JSON.parse(decodeURIComponent(userRaw));
        await signInWithToken(user, token);
        return { success: true };
      }

      return { success: false, error: "Login failed" };
    } catch (e: any) {
      return { success: false, error: e?.message || "Something went wrong" };
    }
  }
};

export const loginWithGoogle = googleAuth.loginWithGoogle;
export default googleAuth;