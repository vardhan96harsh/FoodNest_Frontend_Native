// app/roles/cook/MyMenu.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

/** ================== Types ================== */
type UiStatus = "Processing" | "Ready" | "Picked"; // UI labels
type ApiStatus = "queued" | "processing" | "ready" | "picked";

interface MenuItem {
  id: string;
  name: string;
  status: UiStatus;
  quantity: number; // interpret as kilograms
  perServingLabel: string; // e.g., "100 g"
  imageUrl?: string | null;
  rawMaterials?: Array<{ name: string; qty?: number; unit?: string }>;
}

/** ================== API Helpers ================== */
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://65.2.184.30";

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

async function apiPatch<T>(path: string, body: any): Promise<T> {
  const headers = new Headers(await buildAuthHeaders());
  headers.set("Content-Type", "application/json");
  const r = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

/** ================== Mapping helpers ================== */
function apiToUiStatus(s: ApiStatus): UiStatus {
  if (s === "ready") return "Ready";
  if (s === "picked") return "Picked";
  return "Processing"; // queued/processing -> Processing
}
function uiToApiStatus(s: UiStatus): ApiStatus {
  if (s === "Ready") return "ready";
  if (s === "Picked") return "picked";
  return "processing";
}
function fullImageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  // backend stores "/uploads/foods/..." -> prefix with API_URL
  return `${API_URL}${path}`;
}

/** ================== UI helpers ================== */
function getStatusColors(status: UiStatus) {
  switch (status) {
    case "Ready":
      return { bg: "#DCFCE7", fg: "#166534" };
    case "Picked":
      return { bg: "#E0E7FF", fg: "#3730A3" };
    default:
      return { bg: "#FEF3C7", fg: "#92400E" };
  }
}
function Badge({ status }: { status: UiStatus }) {
  const { bg, fg } = getStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{status}</Text>
    </View>
  );
}

/** ================== Screen ================== */
export default function MyMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  async function loadRequests() {
    setLoading(true);
    try {
      const cookId = await getCookId();
      if (!cookId) {
        setItems([]);
        console.warn("No cookId in storage. Did you save it at login?");
        return;
      }
      const rows = await apiGet<any[]>(`/api/prep-requests?cookId=${cookId}`);

      const mapped: MenuItem[] = rows.map((r) => ({
        id: r._id,
        name: r.foodSnapshot?.name || "Item",
        status: apiToUiStatus(r.status as ApiStatus),
        quantity: r.quantityToPrepare ?? 0, // treat as kilograms
        perServingLabel: r.foodSnapshot?.perServing?.amount
          ? `${r.foodSnapshot.perServing.amount} ${r.foodSnapshot.perServing.unit || ""}`.trim()
          : "—",
        imageUrl: fullImageUrl(r.foodSnapshot?.imageUrl),
        rawMaterials: r.foodSnapshot?.rawMaterials || [],
      }));

      setItems(mapped);
    } catch (e: any) {
      console.warn("Load requests failed:", e?.message || e);
      Alert.alert("Error", "Could not load assigned requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateItemStatus(itemId: string, newStatus: UiStatus) {
    if (newStatus === "Picked") {
      // optional confirm
      // if you don’t want a confirm, remove this Alert and call apiDelete directly
      Alert.alert("Mark as picked?", "This will remove the request.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            // optimistic remove from UI
            setItems(prev => prev.filter(it => it.id !== itemId));
            try {
              await apiDelete(`/api/prep-requests/${itemId}`);
            } catch (e) {
              console.warn("Delete failed:", e);
              // reload to recover if delete failed
              await loadRequests();
            }
          }
        }
      ]);
      return;
    }
  
    // Normal flow for Processing / Ready -> PATCH
    setItems(prev =>
      prev.map(it => (it.id === itemId ? { ...it, status: newStatus } : it))
    );
    try {
      await apiPatch(`/api/prep-requests/${itemId}`, {
        status: uiToApiStatus(newStatus)
      });
    } catch (e) {
      console.warn("Status update failed:", e);
      await loadRequests();
    }
  }
  

  async function updateItemQuantity(itemId: string, text: string) {
    // normalize to numeric kg (allow decimals)
    const value = Number(text.replace(",", "."));
    const qtyKg = Number.isFinite(value) ? value : 0;

    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity: qtyKg } : it))
    );

    try {
      await apiPatch(`/api/prep-requests/${itemId}`, {
        quantityToPrepare: qtyKg,
      });
    } catch (e) {
      console.warn("Quantity update failed:", e);
      await loadRequests();
    }
  }

  async function apiDelete(path: string): Promise<void> {
    const headers = new Headers(await buildAuthHeaders());
    const r = await fetch(`${API_URL}${path}`, { method: "DELETE", headers });
    if (!r.ok) throw new Error(await r.text());
  }
  

  const statusOptions: UiStatus[] = ["Processing", "Ready", "Picked"];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="clipboard" size={20} color="#111827" />
        <Text style={styles.headerTitle}>My Menu</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollInner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
          />
        }
      >
        {loading && items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Loading requests…</Text>
            <Text style={styles.emptySub}>Please wait.</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptySub}>
              You’ll see assigned items here when a supervisor sends them.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              {/* Image */}
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : null}

              {/* Header row */}
              <View style={styles.cardHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Badge status={item.status} />
              </View>

              {/* Per serving + quantity (kg) */}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Per serving</Text>
                  <Text style={styles.value}>{item.perServingLabel}</Text>
                </View>

                <View style={{ width: 150 }}>
                  <Text style={styles.label}>Total quantity to prepare</Text>
                  <View style={styles.qtyWrap}>
                    <TextInput
                      value={String(item.quantity ?? 0)}
                      onChangeText={(t) => updateItemQuantity(item.id, t)}
                      keyboardType="decimal-pad"
                      style={styles.qtyInput}
                      placeholder="0"
                    />
                    <Text style={styles.qtyUnit}>(Unit)</Text>
                  </View>
                </View>
              </View>

              {/* Raw materials – show ALL */}
              {item.rawMaterials && item.rawMaterials.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.label}>Raw materials</Text>
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {item.rawMaterials.map((rm, idx) => (
                      <Text key={idx} style={styles.rmLine}>
                        • {rm.name}
                        {typeof rm.qty === "number"
                          ? ` – ${rm.qty}${rm.unit ? ` ${rm.unit}` : ""}`
                          : ""}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Status segmented control */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.segmentRow}>
                  {statusOptions.map((opt) => {
                    const isActive = item.status === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => updateItemStatus(item.id, opt)}
                        style={[
                          styles.segmentItem,
                          isActive && styles.segmentItemActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            isActive && styles.segmentTextActive,
                          ]}
                        >
                          {opt === "Processing" ? "Start preparing" : opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** ================== Styles ================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  scrollInner: {
    paddingBottom: 24,
    gap: 12,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  emptySub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    gap: 12,
  },
  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  qtyInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 2,
  },
  qtyUnit: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  rmLine: {
    fontSize: 12,
    color: "#374151",
  },
  segmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  segmentItemActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  segmentText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  segmentTextActive: { color: "#FFFFFF" },
});
