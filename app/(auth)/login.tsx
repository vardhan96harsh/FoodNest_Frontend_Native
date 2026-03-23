import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithToken } from "@/lib/authStore";
import { api } from "@/lib/api";
// import { loginWithGoogle } from "@/lib/googleAuth"; // 👈 NEW
import { loginWithGoogle } from "@/lib/googleAuth";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

type Mode = "login" | "forgot" | "otp" | "reset";

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false); // 👈 NEW — separate loader
  const [showPassword, setShowPassword] = useState(false);

  // forgot password flow state
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Keep Animated refs but static (no animation)
  const titleAnim = useRef(new Animated.Value(1)).current;
  const formAnim = useRef(new Animated.Value(1)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  // ─── Existing email/password login (UNCHANGED) ───────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert(
        t("alerts.missingInfo.title"),
        t("alerts.missingInfo.msg")
      );
    }

    setBusy(true);
    try {
      const res = await api.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const payload = res && (res as any).data ? (res as any).data : res;
      const user = payload?.user;
      const jwt = payload?.token || payload?.accessToken;

      if (!jwt) throw new Error(t("errors.noToken"));

      await AsyncStorage.multiSet([
        ["token", jwt],
        ["user", JSON.stringify(user || {})],
        ["role", String(user?.role || "")],
        ["userId", String(user?._id || user?.id || "")],
      ]);

      await signInWithToken(user, jwt);
      router.replace("/");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        t("errors.generic");
      Alert.alert(t("alerts.loginFailed.title"), String(msg));
    } finally {
      setBusy(false);
    }
  };

  // ─── NEW: Google login handler ────────────────────────────────────────────
const handleGoogleLogin = async () => {
  setGoogleBusy(true);
  try {
    const result = await loginWithGoogle();
    if (result.success) {
      router.replace("/"); // index.tsx handles routing to pending or dashboard
    } else if (result.error !== "Login cancelled") {
      Alert.alert("Google Login Failed", result.error);
    }
  } finally {
    setGoogleBusy(false);
  }
};

  const requestOtp = async () => {
    if (!email)
      return Alert.alert(
        t("alerts.emailRequired.title"),
        t("alerts.emailRequired.msg")
      );
    setBusy(true);
    try {
      await api.post("/api/auth/forgot/request-otp", {
        email: email.trim().toLowerCase(),
      });
      Alert.alert(t("alerts.otpSent.title"), t("alerts.otpSent.msg"));
      setMode("otp");
    } catch (e: any) {
      Alert.alert(t("alerts.error.title"), e?.message || t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.trim().length < 4)
      return Alert.alert(
        t("alerts.invalidCode.title"),
        t("alerts.invalidCode.msg")
      );
    setBusy(true);
    try {
      await api.post("/api/auth/forgot/verify", {
        email: email.trim().toLowerCase(),
        code: otp.trim(),
      });
      setMode("reset");
    } catch (e: any) {
      Alert.alert(
        t("alerts.invalidOrExpired.title"),
        e?.message || t("errors.generic")
      );
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return Alert.alert(
        t("alerts.weakPassword.title"),
        t("alerts.weakPassword.msg")
      );
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert(t("alerts.mismatch.title"), t("alerts.mismatch.msg"));
    }
    setBusy(true);
    try {
      await api.post("/api/auth/forgot/reset", {
        email: email.trim().toLowerCase(),
        code: otp.trim(),
        newPassword,
      });
      Alert.alert(t("alerts.success.title"), t("alerts.success.msg"));
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (e: any) {
      Alert.alert(
        t("alerts.couldNotReset.title"),
        e?.message || t("errors.generic")
      );
    } finally {
      setBusy(false);
    }
  };

  const YellowButton = ({
    onPress,
    children,
    disabled,
    style,
  }: {
    onPress: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    style?: any;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.loginButtonContainer, style]}
    >
      <LinearGradient
        colors={
          disabled
            ? ["#FFE082", "#FFCA28", "#FFB300"]
            : ["#FFE082", "#FFC107", "#FFA000"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.loginButtonGradient, disabled && { opacity: 0.7 }]}
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginButtonText}>{children}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <LanguageSwitcher />

      {/* Branding Section */}
      <Animated.View style={[styles.brandingContainer, { opacity: 1 }]}>
        <Text style={styles.mainTitle}>{t("brand.title")}</Text>
        <Text style={styles.slogan}>{t("brand.tagline")}</Text>
      </Animated.View>

      {/* Forms */}
      <Animated.View style={[styles.formContainer, { opacity: 1 }]}>
        {/* Email */}
        <View style={styles.inputContainer}>
          <Feather
            name="mail"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            placeholder={t("placeholders.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            style={styles.textInput}
          />
        </View>

        {mode === "login" && (
          <>
            {/* Password */}
            <View style={styles.inputContainer}>
              <Feather
                name="lock"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder={t("placeholders.password")}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                style={styles.textInput}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                disabled={busy}
                style={styles.eyeButton}
                hitSlop={12}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#666"
                />
              </Pressable>
            </View>

            {/* Forgot link */}
            <Pressable
              onPress={() => setMode("forgot")}
              disabled={busy}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>{t("links.forgotPassword")}</Text>
            </Pressable>
          </>
        )}

        {mode === "forgot" && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{t("forgot.info")}</Text>
          </View>
        )}

        {mode === "otp" && (
          <>
            <View style={styles.inputContainer}>
              <Feather
                name="key"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder={t("placeholders.otp")}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                editable={!busy}
                style={styles.textInput}
              />
            </View>
            <Pressable
              onPress={() => setMode("forgot")}
              disabled={busy}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>{t("links.resendOtp")}</Text>
            </Pressable>
          </>
        )}

        {mode === "reset" && (
          <>
            <View style={styles.inputContainer}>
              <Feather
                name="shield"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder={t("placeholders.newPassword")}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!busy}
                style={styles.textInput}
              />
            </View>
            <View style={styles.inputContainer}>
              <Feather
                name="shield"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder={t("placeholders.confirmPassword")}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!busy}
                style={styles.textInput}
              />
            </View>
          </>
        )}
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonContainer, { opacity: 1 }]}>
        {mode === "login" && (
          <>
            <YellowButton onPress={handleLogin} disabled={busy || googleBusy}>
              {t("buttons.login")}
            </YellowButton>

            {/* ─── Divider ─── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ─── Google Button ─── */}
            <Pressable
              onPress={handleGoogleLogin}
              disabled={busy || googleBusy}
              style={[
                styles.googleButton,
                (busy || googleBusy) && { opacity: 0.6 },
              ]}
            >
              {googleBusy ? (
                <ActivityIndicator color="#444" />
              ) : (
                <>
                  {/* Google "G" logo using text — no extra package needed */}
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}

        {mode === "forgot" && (
          <YellowButton onPress={requestOtp} disabled={busy || !email}>
            {t("buttons.getOtp")}
          </YellowButton>
        )}

        {mode === "otp" && (
          <YellowButton
            onPress={verifyOtp}
            disabled={busy || otp.trim().length < 4}
          >
            {t("buttons.verifyOtp")}
          </YellowButton>
        )}

        {mode === "reset" && (
          <YellowButton
            onPress={resetPassword}
            disabled={
              busy ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword
            }
          >
            {t("buttons.setNewPassword")}
          </YellowButton>
        )}

        {mode !== "login" && (
          <Pressable
            onPress={() => {
              setMode("login");
              setOtp("");
              setNewPassword("");
              setConfirmPassword("");
            }}
            disabled={busy}
            style={[styles.linkRow, { marginTop: 12 }]}
          >
            <Text style={styles.linkTextAlt}>
              <Feather name="arrow-left" size={14} /> {t("links.backToLogin")}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 48, backgroundColor: "#fffbe9" },
  brandingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#7A4F01",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  slogan: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8c6e54",
    textAlign: "center",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  formContainer: { gap: 16, marginBottom: 4 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f1e2b6",
    borderRadius: 16,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, paddingVertical: 16, fontSize: 16, color: "#333" },
  eyeButton: { paddingLeft: 8, paddingVertical: 8 },
  buttonContainer: { alignItems: "center" },
  loginButtonContainer: {
    borderRadius: 16,
    shadowColor: "#FFA000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    minWidth: 200,
    overflow: "hidden",
  },
  loginButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  linkRow: { alignSelf: "flex-end" },
  linkText: { color: "#8c6e54", fontWeight: "700", paddingVertical: 8 },
  linkTextAlt: { color: "#8c6e54", fontWeight: "700" },
  infoBox: {
    backgroundColor: "#FFF3C4",
    borderColor: "#FDE68A",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  infoText: { color: "#7A4F01" },
  // ─── NEW: Google button styles ───────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e8d9b5" },
  dividerText: {
    marginHorizontal: 12,
    color: "#8c6e54",
    fontWeight: "600",
    fontSize: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#e8d9b5",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4285F4",
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
    letterSpacing: 0.3,
  },
});
