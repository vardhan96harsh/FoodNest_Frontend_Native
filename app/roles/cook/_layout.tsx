import { Drawer } from "expo-router/drawer";
import { useRouter } from "expo-router";
import { getUser, onAuthChange, signOut } from "@/lib/authStore";
import { useEffect, useCallback, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable } from "react-native";
import { useMemo } from "react";
import { Link } from "expo-router"; // optional

// Small gradient icon wrapper (yellow food theme) — same vibe as SuperAdmin
function GradientIcon({
  name,
  size = 24,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
}) {
  const box = size + 12; // padding around the icon circle
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

// ===== API + helpers for polling request count http://65.2.184.30 =====

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://l10.140.244.50:1900";
const SEEN_COUNT_KEY = "cook_prep_seen_count";

type HeadersDict = Record<string, string>;

async function buildAuthHeaders(): Promise<HeadersDict> {
  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("accessToken"));
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiGet<T>(path: string): Promise<T> {
  const headers = new Headers(await buildAuthHeaders());
  const r = await fetch(`${API_URL}${path}`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}
async function getCookId(): Promise<string> {
  const byKey = (await AsyncStorage.getItem("userId")) || "";
  if (byKey) return byKey;
  try {
    const user = JSON.parse((await AsyncStorage.getItem("user")) || "{}");
    return user?._id || user?.id || "";
  } catch {
    return "";
  }
}

/** Returns number of active (not picked) prep-requests for this cook */
async function fetchActivePrepCount(): Promise<number> {
  const cookId = await getCookId();
  if (!cookId) return 0;
  // You can refine the filter on backend; here we fetch for the cook and count all not 'picked'
  const rows = await apiGet<any[]>(
    `/api/prep-requests?cookId=${encodeURIComponent(cookId)}`
  );
  return rows.filter((r) => r.status !== "picked").length;
}

export default function CookLayout() {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState(0);
  const [seenCount, setSeenCount] = useState(0);

  const loadSeen = useCallback(async () => {
    const v = await AsyncStorage.getItem(SEEN_COUNT_KEY);
    setSeenCount(v ? Number(v) : 0);
  }, []);

  const pollCount = useCallback(async () => {
    try {
      const n = await fetchActivePrepCount();
      setActiveCount(n);
    } catch (e) {
      // silent fail, keep last count
    }
  }, []);

  const markAllSeen = useCallback(async () => {
    await AsyncStorage.setItem(SEEN_COUNT_KEY, String(activeCount));
    setSeenCount(activeCount);
  }, [activeCount]);

  const hasNew = activeCount > seenCount;

  const [cookName, setCookName] = useState<string>("");
  const [cookEmail, setCookEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const parsed = JSON.parse(raw);
          setCookName(parsed?.name || parsed?.email || "");
          setCookEmail(parsed?.email || "");
        }
      } catch {
        setCookName("");
        setCookEmail("");
      }
    })();
  }, []);

  const initials = useMemo(() => {
    const base = (cookName || cookEmail || "User").trim();
    const parts = base.split(/\s+/);
    const first = parts[0]?.[0] || "U";
    const second = parts[1]?.[0] || "";
    return (first + second).toUpperCase();
  }, [cookName, cookEmail]);

  const HeaderTitle = () => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        onPress={() => router.push("/roles/cook/profile")}
        style={{ marginRight: 10 }}
        accessibilityLabel="Open profile"
      >
        <LinearGradient
          colors={["#FFC107", "#FFA000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{initials}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={{ fontSize: 17, fontWeight: "700", color: "#1f2937" }}>
        {cookName ? `Welcome ${cookName}` : "Welcome Cook"}
      </Text>
    </View>
  );

  // Keep your original auth guard & role check (cook only)
  useEffect(() => {
    const check = () => {
      const u = getUser();
      if (!u) return router.replace("/(auth)/login");
      if (u.role !== "cook") router.replace("/");
    };
    const un = onAuthChange(check);
    check();
    return un;
  }, [router]);

  // load baseline seen count once
  useEffect(() => {
    loadSeen();
  }, [loadSeen]);

  // poll server for current active requests
  useEffect(() => {
    pollCount();
    const t = setInterval(pollCount, 10000); // every 10s
    return () => clearInterval(t);
  }, [pollCount]);

  const handleSignOut = () => {
    signOut();
    router.replace("/(auth)/login");
  };

  return (
    <Drawer
      screenOptions={{
        headerTitle: () => <HeaderTitle />, // << use custom header
        headerTitleAlign: "left",
        drawerActiveTintColor: "#7A4F01",
        drawerActiveBackgroundColor: "rgba(255,193,7,0.12)",
      }}
    >
      {/* NEW: Profile in drawer, place wherever you like */}
      <Drawer.Screen
        name="profile"
        options={{
          title: "Profile",
          drawerIcon: ({ size }) => (
            <GradientIcon name="user" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="CookOverview"
        options={{
          title: "Cook Overview",
          drawerIcon: ({ size }) => (
            <GradientIcon name="home" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="MyMenu"
        options={{
          title: "My Menu",
          drawerIcon: ({ size }) => (
            <View style={styles.iconContainer}>
              <GradientIcon name="book-open" size={size ?? 24} />
              {hasNew ? <View style={styles.countBadge} /> : null}
            </View>
          ),
        }}
        listeners={{
          focus: () => {
            // user has viewed My Menu; mark current active as seen
            markAllSeen();
          },
        }}
      />
      <Drawer.Screen
        name="FoodPrepStatus"
        options={{
          title: "Food Prep Status",
          drawerIcon: ({ size }) => (
            <GradientIcon name="clock" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="RawMaterialRequests"
        options={{
          title: "Raw Material Requests",
          drawerIcon: ({ size }) => (
            <GradientIcon name="shopping-cart" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="RiderRequests"
        options={{
          title: "Rider Requests",
          drawerIcon: ({ size }) => (
            <GradientIcon name="truck" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="Specials"
        options={{
          title: "Specials",
          drawerIcon: ({ size }) => (
            <GradientIcon name="star" size={size ?? 24} />
          ),
        }}
      />
      <Drawer.Screen
        name="KitchenHelpers"
        options={{
          title: "Kitchen Helpers",
          drawerIcon: ({ size }) => (
            <GradientIcon name="users" size={size ?? 24} />
          ),
        }}
      />

      <Drawer.Screen
        name="PrepTasks"
        options={{
          title: "Prep Tasks",
          drawerIcon: ({ size }) => (
            <GradientIcon name="users" size={size ?? 24} />
          ),
        }}
      />

      {/* Custom Signout Button */}
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
          focus: () => {
            // handled by handleSignOut if you wire it on a screen; keeping placeholder here
          },
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
  // Reusable container for icon + badges if you add counts later
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
});
