import React from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { getPending, signOut } from "@/lib/authStore";
import { loginWithGoogle } from "@/lib/googleAuth";

export default function PendingScreen() {
  const router   = useRouter();
  const pending  = getPending();
  const [checking, setChecking] = React.useState(false);

  // Try logging in again — if approved, goes to dashboard
  const handleCheckApproval = async () => {
    setChecking(true);
    try {
      const result = await loginWithGoogle();
      if (result.success && !("pending" in result)) {
        router.replace("/");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFE082", "#FFC107", "#FFA000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <Feather name="clock" size={40} color="#fff" />
      </LinearGradient>

      <Text style={styles.title}>Approval Pending</Text>
      <Text style={styles.subtitle}>
        Hi {pending?.name || "there"}!
      </Text>
      <Text style={styles.desc}>
        Your account <Text style={styles.email}>{pending?.email}</Text> has been
        submitted and is waiting for admin approval.{"\n\n"}
        You'll be notified once approved. You can also tap below to check if
        you've been approved.
      </Text>

      <Pressable
        onPress={handleCheckApproval}
        disabled={checking}
        style={styles.checkButton}
      >
        <LinearGradient
          colors={["#FFE082", "#FFC107", "#FFA000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkButtonGradient}
        >
          {checking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.checkButtonText}>Check Approval Status</Text>
          }
        </LinearGradient>
      </Pressable>

      <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
        <Feather name="log-out" size={16} color="#8c6e54" />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: "#fffbe9", alignItems: "center", justifyContent: "center", padding: 32 },
  iconCircle:           { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 24, elevation: 6 },
  title:                { fontSize: 26, fontWeight: "800", color: "#7A4F01", marginBottom: 8 },
  subtitle:             { fontSize: 18, fontWeight: "600", color: "#5a3e28", marginBottom: 12 },
  desc:                 { fontSize: 15, color: "#6b5c4e", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  email:                { fontWeight: "700", color: "#7A4F01" },
  checkButton:          { borderRadius: 16, overflow: "hidden", minWidth: 220, marginBottom: 16, elevation: 4 },
  checkButtonGradient:  { paddingVertical: 16, paddingHorizontal: 24, alignItems: "center" },
  checkButtonText:      { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  signOutBtn:           { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  signOutText:          { color: "#8c6e54", fontWeight: "600", fontSize: 14 },
});