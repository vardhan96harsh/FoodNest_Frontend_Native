import { Drawer } from "expo-router/drawer";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/authStore";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
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
      style={[
        styles.gradCircle,
        { width: box, height: box, borderRadius: box / 2 },
      ]}
    >
      <Feather name={name} size={size} color="#fff" />
    </LinearGradient>
  );
}

export default function SupervisorLayout() {
  const router = useRouter();

  const [supervisorName, setSupervisorName] = useState<string>("");
  const [supervisorEmail, setSupervisorEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const parsed = JSON.parse(raw);
          setSupervisorName(parsed?.name || parsed?.email || "");
          setSupervisorEmail(parsed?.email || "");
        }
      } catch {
        setSupervisorName("");
        setSupervisorEmail("");
      }
    })();
  }, []);

  const initials = useMemo(() => {
    const base = (supervisorName || supervisorEmail || "User").trim();
    const parts = base.split(/\s+/);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [supervisorName, supervisorEmail]);

  const HeaderTitle = () => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        onPress={() => router.push("/roles/supervisor/profile")}
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
        {supervisorName ? `Welcome ${supervisorName}` : "Welcome Supervisor"}
      </Text>
    </View>
  );

  const handleSignOut = () => {
    signOut();
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
      {/* Profile entry in drawer */}
      <Drawer.Screen
        name="profile"
        options={{
          title: "Profile",
          drawerIcon: ({ size }) => (
            <GradientIcon name="user" size={size ?? 24} />
          ),
        }}
      />

      {/* Map file routes to drawer items */}
      <Drawer.Screen
        name="SupervisorOverview"
        options={{
          title: "Supervisor Overview",
          drawerIcon: ({ size }) => (
            <GradientIcon name="home" size={size ?? 24} />
          ),
        }}
      />

      {/* NEW: Prep Tasks - Add this section */}
      <Drawer.Screen
        name="prep-tasks"
        options={{
          title: "Prep Tasks",
          drawerIcon: ({ size }) => (
            <GradientIcon name="clipboard" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="food-items"
        options={{
          title: "Food Items",
          drawerIcon: ({ size }) => (
            <GradientIcon name="coffee" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="RiderLogs"
        options={{
          title: "Rider Logs",
          drawerIcon: ({ size }) => (
            <GradientIcon name="file-text" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="AssignRider"
        options={{
          title: "Assign Rider",
          drawerIcon: ({ size }) => (
            <GradientIcon name="user-plus" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="ViewInventory"
        options={{
          title: "View Inventory",
          drawerIcon: ({ size }) => (
            <GradientIcon name="eye" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="ViewRoutes"
        options={{
          title: "View Routes",
          drawerIcon: ({ size }) => (
            <GradientIcon name="map" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="RawMaterialInventory"
        options={{
          title: "Raw Material Inventory",
          drawerIcon: ({ size }) => (
            <GradientIcon name="package" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="vehicles-management"
        options={{
          title: "Vehicles Management",
          drawerIcon: ({ size }) => (
            <GradientIcon name="truck" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="Request-management"
        options={{
          title: "Requests Management",
          drawerIcon: ({ size }) => (
            <GradientIcon name="bell" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="RefillRequests"
        options={{
          title: "Refill Requests",
          drawerIcon: ({ size }) => (
            <GradientIcon name="bell" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="PrepTasks"
        options={{
          title: "Prep Tasks",
          drawerIcon: ({ size }) => (
            <GradientIcon name="bell" size={size ?? 24} />
          ),
        }}
      />

      {/* Sign Out */}
      <Drawer.Screen
        name="signout"
        options={{
          title: "Sign Out",
          drawerItemStyle: { marginTop: "auto" },
          drawerIcon: ({ size }) => (
            <GradientIcon name="log-out" size={size ?? 24} />
          ),
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
