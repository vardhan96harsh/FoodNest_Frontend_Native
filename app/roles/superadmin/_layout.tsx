import { Drawer } from "expo-router/drawer";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/authStore";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Text, Pressable, Image } from "react-native";
import { api } from "@/lib/api";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Small gradient icon wrapper (yellow food theme)
function GradientIcon({ name, size = 24 }: { name: any; size?: number }) {
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

export default function SuperAdminLayout() {
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [superadminName, setSuperadminName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const handleSignOut = () => {
    // (kept for backward compatibility if you keep the drawer Sign Out item)
    signOut();
    router.replace("/(auth)/login");
  };

  const refreshPendingCount = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ count: number }>(
        "/api/admin/requests/count"
      );
      setPendingRequests(data.count);
    } catch (error) {
      console.error("Error fetching pending requests count:", error);
      if (pendingRequests === 0) setPendingRequests(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPendingCount();
    const id = setInterval(refreshPendingCount, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const parsed = JSON.parse(raw);
          setSuperadminName(parsed?.name || parsed?.email || "");
          setUserEmail(parsed?.email || "");
        }
      } catch {
        setSuperadminName("");
        setUserEmail("");
      }
    })();
  }, []);

  // Build initials for avatar fallback
  const initials = useMemo(() => {
    const n = (superadminName || userEmail || "User").trim();
    const parts = n.split(/\s+/);
    return (
      (parts[0]?.[0] || "U").toUpperCase() + (parts[1]?.[0] || "").toUpperCase()
    );
  }, [superadminName, userEmail]);

  // Custom header with round profile button + title
  const HeaderTitle = () => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        onPress={() => router.push("/roles/superadmin/profile")}
        style={{ marginRight: 10 }}
        accessibilityLabel="Open profile"
      >
        {/* Avatar: try user image if you have it later; for now a gradient with initials */}
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
        {superadminName ? `Welcome ${superadminName}` : "Welcome SuperAdmin"}
      </Text>
    </View>
  );

  return (
    <Drawer
      screenOptions={{
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: "left",
        drawerActiveTintColor: "#7A4F01",
        drawerActiveBackgroundColor: "rgba(255,193,7,0.12)",
      }}
    >
      <Drawer.Screen
        name="profile"
        options={{
          title: "Profile",
          drawerIcon: ({ size }) => <GradientIcon name="user" size={size} />,
        }}
      />
      <Drawer.Screen
        name="overview"
        options={{
          title: "Overview",
          drawerIcon: ({ size }) => <GradientIcon name="home" size={size} />,
        }}
      />

      <Drawer.Screen
        name="user-management"
        options={{
          title: `User Management${
            pendingRequests > 0 ? ` (${pendingRequests} pending)` : ""
          }`,
          drawerIcon: ({ size }) => (
            <View style={styles.iconContainer}>
              <GradientIcon name="users" size={size} />
              {pendingRequests > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingRequests}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{ focus: () => refreshPendingCount() }}
      />

      <Drawer.Screen
        name="food-items"
        options={{
          title: "Food Items",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="coffee" size={size} />,
        }}
      />
      <Drawer.Screen
        name="inventory"
        options={{
          title: "Inventory",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="package" size={size} />,
        }}
      />
      <Drawer.Screen
        name="routes-management"
        options={{
          title: "Routes Management",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="map" size={size} />,
        }}
      />
      <Drawer.Screen
        name="team-management"
        options={{
          title: "Team Management",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="users" size={size} />,
        }}
      />
      <Drawer.Screen
        name="combos-management"
        options={{
          title: "Combos Management",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="layers" size={size} />,
        }}
      />
      <Drawer.Screen
        name="vehicles-management"
        options={{
          title: "Vehicles Management",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => <GradientIcon name="truck" size={size} />,
        }}
      />

      <Drawer.Screen
        name="batteries-management"
        options={{
          title: "Batteries Management",
          drawerIcon: ({ size }) => (
            <GradientIcon name="battery-charging" size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name="analytics"
        options={{
          title: "Analytics",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => (
            <GradientIcon name="bar-chart-2" size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="misc-expenses"
        options={{
          title: "Expenses",
          drawerLabel: "Expenses",
          //  drawerItemStyle: { display: "none" },
          drawerIcon: ({ size }) => (
            <GradientIcon name="credit-card" size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name="signout"
        options={{
          title: "Sign Out",
          drawerItemStyle: { marginTop: "auto" },
          drawerIcon: ({ size }) => <GradientIcon name="log-out" size={size} />,
        }}
        listeners={{ focus: handleSignOut }}
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
  iconContainer: {
    position: "relative",
  },
  countBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  countText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
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
