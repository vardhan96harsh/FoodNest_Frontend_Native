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
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { loginWithGoogle } from "@/lib/googleAuth"; // 👈 NEW
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type Role = "rider" | "cook" | "supervisor" | "refill";
const ROLES: { label: string; value: Role }[] = [
  { label: "Rider", value: "rider" },
  { label: "Cook", value: "cook" },
  { label: "Supervisor", value: "supervisor" },
  { label: "Refill Coordinator", value: "refill" },
];

export default function RegisterScreen() {
  const router = useRouter(); // 👈 NEW
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("rider");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false); // 👈 NEW
  const [showPassword, setShowPassword] = useState(false);

  const titleAnim = useRef(new Animated.Value(1)).current;
  const formAnim = useRef(new Animated.Value(1)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  // ─── Existing register flow (UNCHANGED) ──────────────────────────────────
  const onSubmit = async () => {
    if (!email || !name || !password) return Alert.alert("Missing info", "Please enter all fields.");
    setBusy(true);
    try {
      await api.post("/api/auth/register-request", {
        email: email.trim(), name: name.trim(), role, password
      });
      Alert.alert("Request sent", "SuperAdmin will approve your account.");
      setEmail(""); setName(""); setPassword(""); setRole("rider");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send request.");
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
        router.replace("/");
      } else {
        if (result.error !== "Login cancelled") {
          Alert.alert("Google Login Failed", result.error || "Something went wrong");
        }
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Branding Section */}
      <Animated.View style={[styles.brandingContainer, { opacity: 1 }]}>
        <Text style={styles.mainTitle}>Food-Nest</Text>
        <Text style={styles.slogan}>Your Street, Your Feast.</Text>
      </Animated.View>

      {/* Form Section */}
      <Animated.View style={[styles.formContainer, { opacity: 1 }]}>
        <View style={styles.inputContainer}>
          <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            style={styles.textInput}
          />
        </View>

        <View style={styles.inputContainer}>
          <Feather name="user" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            editable={!busy}
            style={styles.textInput}
          />
        </View>

        <View style={styles.pickerContainer}>
          <Feather name="briefcase" size={20} color="#666" style={styles.inputIcon} />
          <View style={styles.pickerWrapper}>
            <Picker
              enabled={!busy}
              selectedValue={role}
              onValueChange={(v) => setRole(v)}
              style={styles.picker}
            >
              {ROLES.map((r) => (
                <Picker.Item key={r.value} label={r.label} value={r.value} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
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
            <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Button Section */}
      <Animated.View style={[styles.buttonContainer, { opacity: 1 }]}>
        {/* Existing register button (UNCHANGED) */}
        <Pressable
          onPress={onSubmit}
          disabled={busy || googleBusy}
          style={styles.registerButtonWrap}
        >
          <LinearGradient
            colors={busy ? ["#FFE082", "#FFCA28", "#FFB300"] : ["#FFE082", "#FFC107", "#FFA000"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.registerButton, busy && { opacity: 0.7 }]}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.registerButtonText}>Request Registration</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.infoText}>
          After approval, use the same credentials here to log in.
        </Text>

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
          style={[styles.googleButton, (busy || googleBusy) && { opacity: 0.6 }]}
        >
          {googleBusy ? (
            <ActivityIndicator color="#444" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, backgroundColor: "#fffbe9" },
  brandingContainer: { alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 10 },
  mainTitle: { fontSize: 36, fontWeight: "800", color: "#7A4F01", textAlign: "center", marginBottom: 4, letterSpacing: 1 },
  slogan: { fontSize: 16, fontWeight: "500", color: "#8c6e54", textAlign: "center", fontStyle: "italic", letterSpacing: 0.5 },
  formContainer: { gap: 10, marginBottom: 24 },
  inputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: "#f1e2b6", borderRadius: 16, backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 2 },
  pickerContainer: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: "#f1e2b6", borderRadius: 16, backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 4 },
  pickerWrapper: { flex: 1, borderLeftWidth: 1, borderLeftColor: "#f1e2b6", paddingLeft: 12 },
  picker: { height: 50, color: "#333" },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#333" },
  eyeButton: { paddingLeft: 8, paddingVertical: 8 },
  buttonContainer: { alignItems: "center" },
  registerButtonWrap: { borderRadius: 16, shadowColor: "#FFA000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5, minWidth: 200, overflow: "hidden", marginBottom: 16 },
  registerButton: { paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  registerButtonText: { color: "white", fontWeight: "700", fontSize: 16, letterSpacing: 0.5, textTransform: "uppercase" },
  infoText: { color: "#7a6a55", fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  // ─── NEW: Google button styles ───────────────────────────────────────────
  dividerRow: { flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e8d9b5" },
  dividerText: { marginHorizontal: 12, color: "#8c6e54", fontWeight: "600", fontSize: 14 },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 2, borderColor: "#e8d9b5", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, minWidth: 200, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  googleIcon: { fontSize: 18, fontWeight: "800", color: "#4285F4", marginRight: 10 },
  googleButtonText: { fontSize: 15, fontWeight: "700", color: "#444", letterSpacing: 0.3 },
});