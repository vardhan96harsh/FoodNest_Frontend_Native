import { Drawer } from "expo-router/drawer";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/authStore";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

function GradientIcon({
  name,
  size = 24,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
}) {
  const box = size + 12;
  return (
    <LinearGradient
      colors={["#FFE082", "#FFC107", "#FFA000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradCircle, { width: box, height: box, borderRadius: box / 2 }]}
    >
      <Feather name={name} size={size} color="#fff" />
    </LinearGradient>
  );
}

export default function RiderLayout() {
  const router = useRouter();

  const [riderName, setRiderName] = useState<string>("");
  const [riderEmail, setRiderEmail] = useState<string>("");

  useEffect(() => {
  (async () => {
    try {
      const raw = await AsyncStorage.getItem("auth.user")
                  || await AsyncStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setRiderName(parsed?.name || parsed?.email || "");
        setRiderEmail(parsed?.email || "");
      }
    } catch {
      setRiderName("");
      setRiderEmail("");
    }
  })();
}, []);

  const initials = useMemo(() => {
    const base = (riderName || riderEmail || "User").trim();
    const parts = base.split(/\s+/);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [riderName, riderEmail]);

  const HeaderTitle = () => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        onPress={() => router.push("/roles/rider/profile")}
        style={{ marginRight: 10 }}
        accessibilityLabel="Open profile"
      >
        <LinearGradient
          colors={["#FFC107", "#FFA000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.headerTitleText}>
        {riderName ? `Welcome ${riderName}` : "Welcome Rider"}
      </Text>
    </View>
  );

const handleSignOut = async () => {
  await signOut();  // ← await it
  router.replace("/(auth)/login");
};

  return (
    <Drawer
      screenOptions={{
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: "left",
        drawerActiveTintColor: "#7A4F01",
        drawerActiveBackgroundColor: "rgba(255,193,7,0.12)",
      }}
    >
      {/* NEW: Profile item */}
      <Drawer.Screen
        name="profile"
        options={{
          title: "Profile",
          drawerIcon: ({ size }) => <GradientIcon name="user" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="RiderOverview"
        options={{
          title: "Rider Overview",
          drawerIcon: ({ size }) => <GradientIcon name="home" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="RiderLogs"
        options={{
          title: "Log Sales",
          drawerIcon: ({ size }) => <GradientIcon name="file-text" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="CartHealth"
        options={{
          title: "Cart Health",
          drawerIcon: ({ size }) => <GradientIcon name="heart" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="MyRoute"
        options={{
          title: "My Route",
          drawerIcon: ({ size }) => <GradientIcon name="map" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="RequestMore"
        options={{
          title: "Request More",
          drawerIcon: ({ size }) => <GradientIcon name="plus-circle" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="AvialableVehicles"
        options={{
          title: "Available Vehicles",
          drawerIcon: ({ size }) => <GradientIcon name="truck" size={size ?? 24} />,
        }}
      />

      <Drawer.Screen
        name="MyInventory"
        options={{
          title: "My Inventory",
          drawerIcon: ({ size }) => <GradientIcon name="package" size={size ?? 24} />,
        }}
      />

      {/* Sign Out */}
      <Drawer.Screen
        name="signout"
        options={{
          title: "Sign Out",
          drawerItemStyle: { marginTop: "auto" },
          drawerIcon: ({ size }) => <GradientIcon name="log-out" size={size ?? 24} />,
        }}
        listeners={{
          focus: handleSignOut,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  gradCircle: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFA000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
  },
});
