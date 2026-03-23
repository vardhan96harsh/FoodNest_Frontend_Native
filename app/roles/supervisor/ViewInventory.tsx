// screens/ViewInventory.tsx - Updated with correct API endpoints
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";

// ==================== TYPES ====================

type FoodItem = {
  _id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  unit?: string;
  minimumStock?: number;
};

type SupervisorInventoryItem = {
  foodItem: string;
  name: string;
  price: number;
  quantity: number;
  locked: number;
  available: number;
  lowStock?: boolean;
  unit?: string;
  category?: string;
  status?: string;
};

type PrepRequest = {
  _id: string;
  status: "queued" | "processing" | "ready" | "picked";
  quantityToPrepare?: number;
  cookId?: string;
  cookName?: string;
  createdAt?: string;
  foodSnapshot?: {
    name?: string;
    imageUrl?: string;
    perServing?: { amount?: number; unit?: string };
    rawMaterials?: Array<{ name: string; qty?: number; unit?: string }>;
  };
};

// ==================== CONSTANTS ====================

const tone = {
  success: "#059669",
  warning: "#d97706",
  destructive: "#dc2626",
  primary: "#2563eb",
  info: "#0891b2",
} as const;

// ==================== HELPER FUNCTIONS ====================

const apiToUiStatus = (status: string): string => {
  if (status === "ready") return "Ready";
  if (status === "picked") return "Picked";
  return "Processing";
};

// ==================== COMPONENTS ====================

function Badge({
  text,
  variant = "solid",
  color = "#2563eb",
}: {
  text: string;
  variant?: "solid" | "outline";
  color?: string;
}) {
  const solid = variant === "solid";
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: solid ? color : "transparent",
          borderColor: color,
        },
      ]}
    >
      <Text style={{ color: solid ? "#fff" : color, fontSize: 11, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

function TotalStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ViewInventoryScreen() {
  const [supervisorInventory, setSupervisorInventory] = useState<SupervisorInventoryItem[]>([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalLocked: 0,
    totalAvailable: 0,
    lowStockItems: 0,
    status: "draft"
  });
  
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [prepRequests, setPrepRequests] = useState<PrepRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [addQty, setAddQty] = useState("");
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ===== Fetch all data with correct endpoints =====
  const fetchData = useCallback(async () => {
    try {
      // Fetch food items
      let foods: FoodItem[] = [];
      try {
        foods = await api.get<FoodItem[]>("/api/foods");
        setFoodItems(foods);
      } catch (err) {
        console.warn("Failed to fetch foods:", err);
      }

      // ✅ CORRECT ENDPOINT: /api/supervisor-inventory/today
      let inventoryData: any = { inventory: { items: [] } };
      try {
        inventoryData = await api.get("/api/supervisor-inventory/today");
        setSupervisorInventory(inventoryData.inventory?.items || []);
        setInventoryStats({
          totalItems: inventoryData.inventory?.totalItems || 0,
          totalQuantity: inventoryData.inventory?.totalQuantity || 0,
          totalLocked: inventoryData.inventory?.totalLocked || 0,
          totalAvailable: inventoryData.inventory?.totalAvailable || 0,
          lowStockItems: inventoryData.inventory?.lowStockItems || 0,
          status: inventoryData.inventory?.status || "draft"
        });
      } catch (err) {
        console.warn("Failed to fetch inventory:", err);
      }

      // Fetch prep requests
      let prepReqs: PrepRequest[] = [];
      try {
        prepReqs = await api.get<PrepRequest[]>("/api/prep-requests");
        setPrepRequests(prepReqs || []);
      } catch (err) {
        console.warn("Failed to fetch prep requests:", err);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ===== Add to supervisor inventory with correct endpoint =====
  const addToInventory = async () => {
    if (!selectedFood) {
      Alert.alert("Error", "Please select a food item");
      return;
    }

    const qty = Number(addQty.replace(/[^\d]/g, "")) || 0;
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    try {
      setSaving(true);
      
      // ✅ CORRECT ENDPOINT: /api/supervisor-inventory/items
      await api.post("/api/supervisor-inventory/items", {
        foodItemId: selectedFood._id,
        quantity: qty,
        notes: "Added via mobile app",
      });

      await fetchData();
      setAddModalOpen(false);
      setSelectedFood(null);
      setAddQty("");
      Alert.alert("Success", "Item added to inventory");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center", flex: 1 }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12, color: "#6b7280" }}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Inventory Management</Text>
          <Text style={styles.subtle}>
            Status: <Badge 
              text={inventoryStats.status.toUpperCase()} 
              variant="solid" 
              color={inventoryStats.status === "draft" ? tone.warning : tone.success} 
            />
          </Text>
        </View>

        {inventoryStats.status === "draft" && (
          <Pressable style={styles.addBtn} onPress={() => setAddModalOpen(true)}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Stock</Text>
          </Pressable>
        )}
      </View>

      {/* Summary Stats */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <Text style={styles.subtle}>{new Date().toLocaleDateString()}</Text>

        <View style={styles.totalsGrid}>
          <TotalStat label="Total Items" value={String(inventoryStats.totalItems)} />
          <TotalStat label="Total Qty" value={String(inventoryStats.totalQuantity)} />
          <TotalStat label="Low Stock" value={String(inventoryStats.lowStockItems)} color={tone.warning} />
        </View>

        <View style={styles.totalsGrid}>
          <TotalStat label="Total Stock" value={String(
            supervisorInventory.reduce((sum, x) => sum + x.quantity, 0)
          )} />
          <TotalStat label="Locked" value={String(
            supervisorInventory.reduce((sum, x) => sum + x.locked, 0)
          )} color={tone.warning} />
          <TotalStat label="Available" value={String(
            supervisorInventory.reduce((sum, x) => sum + x.available, 0)
          )} color={tone.success} />
        </View>
      </View>

      {/* Inventory Items */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Inventory</Text>
        <Text style={styles.subtle}>Items you have in stock</Text>

        {supervisorInventory.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="package" size={40} color="#d1d5db" />
            <Text style={[styles.subtle, { marginTop: 8 }]}>No items in inventory</Text>
            {inventoryStats.status === "draft" && (
              <Pressable style={[styles.ghostBtn, { marginTop: 12 }]} onPress={() => setAddModalOpen(true)}>
                <Text style={styles.ghostBtnText}>Add your first item</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.listWrap}>
            {supervisorInventory.map((item, idx) => (
              <View key={item.foodItem}>
                <View style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                      <Text style={styles.listLeft}>{item.name}</Text>
                      {item.lowStock && (
                        <Badge text="Low" variant="solid" color={tone.warning} />
                      )}
                      {item.status === "out_of_stock" && (
                        <Badge text="Out" variant="solid" color={tone.destructive} />
                      )}
                    </View>
                    <Text style={styles.subtleSmall}>Price: ₹{item.price}</Text>
                    {item.category && (
                      <Text style={styles.subtleSmall}>Category: {item.category}</Text>
                    )}
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.rightTop}>Total: {item.quantity}</Text>
                    <Text style={[styles.subtleSmall, { color: tone.warning }]}>
                      Locked: {item.locked}
                    </Text>
                    <Text style={[styles.subtleSmall, { color: tone.success }]}>
                      Available: {item.available}
                    </Text>
                  </View>
                </View>
                {idx < supervisorInventory.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Food Items */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Available Food Items</Text>
        <Text style={styles.subtle}>Items you can add to inventory</Text>

        <View style={styles.listWrap}>
          {foodItems.filter(f => f.available).map((food, idx) => {
            const inInventory = supervisorInventory.find(i => i.foodItem === food._id);
            
            return (
              <View key={food._id}>
                <View style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listLeft}>{food.name}</Text>
                    <Text style={styles.subtleSmall}>Category: {food.category}</Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.rightTop}>₹{food.price}</Text>
                    {inInventory && (
                      <Text style={[styles.subtleSmall, { color: tone.success }]}>
                        In stock: {inInventory.available}
                      </Text>
                    )}
                  </View>
                </View>
                {idx < foodItems.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>
      </View>

      {/* Preparation Requests */}
      {prepRequests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preparation Requests</Text>
          <Text style={styles.subtle}>Track cooking status</Text>

          <View style={styles.listWrap}>
            {prepRequests.slice(0, 5).map((req, idx) => {
              const uiStatus = apiToUiStatus(req.status);
              const statusColor = 
                uiStatus === "Ready" ? tone.success :
                uiStatus === "Picked" ? tone.info : tone.warning;

              return (
                <View key={req._id}>
                  <View style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listLeft}>
                        {req.foodSnapshot?.name || "Food Item"}
                      </Text>
                      <Text style={styles.subtleSmall}>
                        Qty: {req.quantityToPrepare || 1}
                      </Text>
                    </View>

                    <Badge text={uiStatus} variant="solid" color={statusColor} />
                  </View>
                  {idx < Math.min(prepRequests.length, 5) - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Add Stock Modal */}
      <Modal transparent animationType="slide" visible={addModalOpen} onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Stock</Text>
            <Pressable onPress={() => setAddModalOpen(false)}>
              <Feather name="x" size={22} />
            </Pressable>
          </View>

          <Pressable style={styles.inputLike} onPress={() => setFoodPickerOpen(true)}>
            <Text style={selectedFood ? styles.inputValue : styles.inputPlaceholder}>
              {selectedFood ? selectedFood.name : "Select food item"}
            </Text>
            <Feather name="chevron-down" size={18} color="#6b7280" />
          </Pressable>

          <View style={{ height: 12 }} />

          <TextInput
            style={styles.qtyInput}
            placeholder="Enter quantity"
            keyboardType="number-pad"
            value={addQty}
            onChangeText={(t) => setAddQty(t.replace(/[^\d]/g, ""))}
          />

          <View style={{ height: 14 }} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={addToInventory} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Add</Text>}
            </Pressable>

            <Pressable
              style={[styles.ghostBtn, { flex: 1 }]}
              onPress={() => {
                setAddModalOpen(false);
                setSelectedFood(null);
                setAddQty("");
              }}
            >
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Food Picker Modal */}
      <Modal transparent animationType="slide" visible={foodPickerOpen} onRequestClose={() => setFoodPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setFoodPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Food Item</Text>
            <Pressable onPress={() => setFoodPickerOpen(false)}>
              <Feather name="x" size={20} />
            </Pressable>
          </View>
          <ScrollView>
            {foodItems.filter(f => f.available).map((item) => (
              <Pressable
                key={item._id}
                style={styles.optionRow}
                onPress={() => {
                  setSelectedFood(item);
                  setFoodPickerOpen(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: "#111827" }}>{item.name}</Text>
                  <Text style={styles.subtleSmall}>Category: {item.category}</Text>
                </View>
                <Text style={styles.subtleSmall}>₹{item.price}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: "#f9fafb" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280" },
  subtleSmall: { color: "#6b7280", fontSize: 12 },

  row: { flexDirection: "row" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },

  listWrap: { borderWidth: 1, borderColor: "#eef1f5", borderRadius: 12, overflow: "hidden" },
  listRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  listLeft: { fontWeight: "700", color: "#111827" },
  rightTop: { fontSize: 12, fontWeight: "700", color: "#111827" },
  divider: { height: 1, backgroundColor: "#eef1f5" },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  totalsGrid: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef1f5",
    paddingTop: 12,
    marginTop: 12,
  },
  totalLabel: { fontSize: 12, color: "#6b7280" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#111827", marginTop: 2 },

  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  emptyBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  modalCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  inputLike: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputPlaceholder: { color: "#6b7280" },
  inputValue: { color: "#111827", fontWeight: "700" },

  qtyInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#fff",
  },

  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },

  ghostBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ghostBtnText: {
    color: "#111827",
    fontWeight: "800",
  },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});