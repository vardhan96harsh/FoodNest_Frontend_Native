// screens/ViewInventory.tsx - Complete working version with permanent items support and delete functionality
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
  isPermanent: boolean;
  originalPrice?: number;
  discount?: number;
  isDiscounted?: boolean;
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
  isPermanent: boolean;
  id?: string;
};

type PermanentStockItem = {
  foodItem: string;
  name: string;
  quantity: number;
  locked: number;
  available: number;
  lowStock?: boolean;
  unit?: string;
  category?: string;
  status?: string;
  isPermanent: boolean;
  lastRestocked?: Date;
  id?: string;
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
  permanent: "#8b5cf6",
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
  const [dailyInventory, setDailyInventory] = useState<SupervisorInventoryItem[]>([]);
  const [permanentStock, setPermanentStock] = useState<PermanentStockItem[]>([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalLocked: 0,
    totalAvailable: 0,
    lowStockItems: 0,
    status: "draft",
    permanentItems: 0,
    permanentStockValue: 0,
    dailyItemsValue: 0
  });
  
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [prepRequests, setPrepRequests] = useState<PrepRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "permanent">("daily");
  const [deleting, setDeleting] = useState(false);

  // Modal states for daily inventory
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [addQty, setAddQty] = useState("");
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal states for permanent stock
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockItems, setRestockItems] = useState<Array<{ foodItemId: string; quantity: string }>>([]);
  const [selectedRestockFood, setSelectedRestockFood] = useState<FoodItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockPickerOpen, setRestockPickerOpen] = useState(false);

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: "daily" | "permanent" } | null>(null);

  // ===== Fetch all data =====
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

      // Fetch daily inventory (temporary items only)
      let dailyData: any = { inventory: { items: [] } };
      try {
        dailyData = await api.get("/api/supervisor-inventory/today");
        setDailyInventory(dailyData.inventory?.items || []);
        setInventoryStats(prev => ({
          ...prev,
          totalItems: dailyData.inventory?.totalItems || 0,
          totalQuantity: dailyData.inventory?.totalQuantity || 0,
          totalLocked: dailyData.inventory?.totalLocked || 0,
          totalAvailable: dailyData.inventory?.totalAvailable || 0,
          lowStockItems: dailyData.inventory?.lowStockItems || 0,
          status: dailyData.inventory?.status || "draft",
          dailyItemsValue: dailyData.inventory?.totalQuantity || 0
        }));
      } catch (err) {
        console.warn("Failed to fetch daily inventory:", err);
      }

      // Fetch permanent stock
      try {
        const permanentData = await api.get("/api/supervisor-inventory/permanent-stock");
        setPermanentStock(permanentData.inventory?.items || []);
        setInventoryStats(prev => ({
          ...prev,
          permanentItems: permanentData.inventory?.totalItems || 0,
          permanentStockValue: permanentData.inventory?.totalQuantity || 0
        }));
      } catch (err) {
        console.warn("Failed to fetch permanent stock:", err);
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

  // ===== Add to daily inventory =====
  const addToDailyInventory = async () => {
    if (!selectedFood) {
      Alert.alert("Error", "Please select a food item");
      return;
    }

    if (selectedFood.isPermanent) {
      Alert.alert("Error", "Permanent items cannot be added to daily inventory. Use Restock for permanent items.");
      return;
    }

    const qty = Number(addQty.replace(/[^\d]/g, "")) || 0;
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    try {
      setSaving(true);
      await api.post("/api/supervisor-inventory/items", {
        foodItemId: selectedFood._id,
        quantity: qty,
        notes: "Added via mobile app",
      });

      await fetchData();
      setAddModalOpen(false);
      setSelectedFood(null);
      setAddQty("");
      Alert.alert("Success", "Item added to daily inventory");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  // ===== Delete item from inventory =====
  const deleteInventoryItem = async () => {
    if (!itemToDelete) return;

    try {
      setDeleting(true);
      
      if (itemToDelete.type === "daily") {
        // Delete from daily inventory
        await api.delete(`/api/supervisor-inventory/daily-items/${itemToDelete.id}`);
        Alert.alert("Success", "Item removed from daily inventory");
      } else {
        // Delete from permanent stock
        await api.delete(`/api/supervisor-inventory/items/${itemToDelete.id}`);
        Alert.alert("Success", "Item removed from permanent stock");
      }
      
      await fetchData();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  // ===== Restock permanent items =====
  const addRestockItem = () => {
    if (!selectedRestockFood) {
      Alert.alert("Error", "Please select a food item");
      return;
    }

    if (!selectedRestockFood.isPermanent) {
      Alert.alert("Error", "Only permanent items can be restocked");
      return;
    }

    const qty = Number(restockQty.replace(/[^\d]/g, "")) || 0;
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    const existingIndex = restockItems.findIndex(item => item.foodItemId === selectedRestockFood._id);
    if (existingIndex >= 0) {
      const updated = [...restockItems];
      updated[existingIndex].quantity = String(Number(updated[existingIndex].quantity) + qty);
      setRestockItems(updated);
    } else {
      setRestockItems([...restockItems, { foodItemId: selectedRestockFood._id, quantity: String(qty) }]);
    }

    setSelectedRestockFood(null);
    setRestockQty("");
    setRestockPickerOpen(false);
  };

  const submitRestock = async () => {
    if (restockItems.length === 0) {
      Alert.alert("Error", "Please add at least one item to restock");
      return;
    }

    const formattedItems = restockItems.map(item => ({
      foodItemId: item.foodItemId,
      quantity: Number(item.quantity)
    }));

    try {
      setSaving(true);
      await api.post("/api/supervisor-inventory/permanent-stock/restock", {
        items: formattedItems,
        notes: "Restocked via mobile app"
      });

      await fetchData();
      setRestockModalOpen(false);
      setRestockItems([]);
      Alert.alert("Success", "Permanent stock updated successfully");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to restock");
    } finally {
      setSaving(false);
    }
  };

  const removeRestockItem = (index: number) => {
    setRestockItems(restockItems.filter((_, i) => i !== index));
  };

  // ===== Render inventory items with delete button =====
  const renderInventoryItem = (item: SupervisorInventoryItem | PermanentStockItem, index: number, total: number) => (
    <View key={item.foodItem}>
      <View style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <View style={[styles.row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
            <Text style={styles.listLeft}>{item.name}</Text>
            {item.isPermanent && (
              <Badge text="Permanent" variant="solid" color={tone.permanent} />
            )}
            {!item.isPermanent && item.lowStock && (
              <Badge text="Low Stock" variant="solid" color={tone.warning} />
            )}
            {!item.isPermanent && item.status === "out_of_stock" && (
              <Badge text="Out of Stock" variant="solid" color={tone.destructive} />
            )}
          </View>
          <Text style={styles.subtleSmall}>Unit: {item.unit || "piece"}</Text>
          {item.category && (
            <Text style={styles.subtleSmall}>Category: {item.category}</Text>
          )}
        </View>

        <View style={{ alignItems: "flex-end", marginRight: 12 }}>
          <Text style={styles.rightTop}>Stock: {item.quantity}</Text>
          {item.locked > 0 && (
            <Text style={[styles.subtleSmall, { color: tone.warning }]}>
              Locked: {item.locked}
            </Text>
          )}
          <Text style={[styles.subtleSmall, { color: tone.success }]}>
            Available: {item.available}
          </Text>
        </View>

        {/* Delete Button - Only show if no locked items */}
        {item.locked === 0 && (
          <Pressable
            onPress={() => {
              setItemToDelete({
                id: item.id || item.foodItem,
                name: item.name,
                type: item.isPermanent ? "permanent" : "daily"
              });
              setDeleteModalOpen(true);
            }}
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={18} color={tone.destructive} />
          </Pressable>
        )}
      </View>
      {index < total - 1 && <View style={styles.divider} />}
    </View>
  );

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
            Daily Status: <Badge 
              text={inventoryStats.status.toUpperCase()} 
              variant="solid" 
              color={inventoryStats.status === "draft" ? tone.warning : tone.success} 
            />
          </Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <Text style={styles.subtle}>{new Date().toLocaleDateString()}</Text>

        <View style={styles.totalsGrid}>
          <TotalStat label="Daily Items" value={String(inventoryStats.totalItems)} />
          <TotalStat label="Daily Qty" value={String(inventoryStats.dailyItemsValue)} />
          <TotalStat label="Permanent Items" value={String(inventoryStats.permanentItems)} />
        </View>

        <View style={styles.totalsGrid}>
          <TotalStat label="Available" value={String(inventoryStats.totalAvailable)} color={tone.success} />
          <TotalStat label="Locked" value={String(inventoryStats.totalLocked)} color={tone.warning} />
          <TotalStat label="Low Stock" value={String(inventoryStats.lowStockItems)} color={tone.destructive} />
        </View>
        
        {/* Permanent Stock Value Row */}
        <View style={[styles.totalsGrid, { borderTopWidth: 1, borderTopColor: "#eef1f5", paddingTop: 12, marginTop: 12 }]}>
          <TotalStat label="Permanent Stock Qty" value={String(inventoryStats.permanentStockValue)} color={tone.permanent} />
          <TotalStat label="Total Items" value={String(inventoryStats.totalItems + inventoryStats.permanentItems)} />
          <TotalStat label="Total Stock" value={String(inventoryStats.dailyItemsValue + inventoryStats.permanentStockValue)} />
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "daily" && styles.tabActive]}
          onPress={() => setActiveTab("daily")}
        >
          <Feather name="calendar" size={16} color={activeTab === "daily" ? tone.primary : "#6b7280"} />
          <Text style={[styles.tabText, activeTab === "daily" && styles.tabTextActive]}>
            Daily Inventory
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "permanent" && styles.tabActive]}
          onPress={() => setActiveTab("permanent")}
        >
          <Feather name="archive" size={16} color={activeTab === "permanent" ? tone.primary : "#6b7280"} />
          <Text style={[styles.tabText, activeTab === "permanent" && styles.tabTextActive]}>
            Permanent Stock
          </Text>
        </Pressable>
      </View>

      {/* Daily Inventory Tab */}
      {activeTab === "daily" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Daily Inventory Items</Text>
            {inventoryStats.status === "draft" && (
              <Pressable style={styles.iconBtn} onPress={() => setAddModalOpen(true)}>
                <Feather name="plus" size={18} color={tone.primary} />
                <Text style={{ color: tone.primary, marginLeft: 4 }}>Add</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.subtle}>Temporary items for today's service</Text>

          {dailyInventory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="package" size={40} color="#d1d5db" />
              <Text style={[styles.subtle, { marginTop: 8 }]}>No items in daily inventory</Text>
              {inventoryStats.status === "draft" && (
                <Pressable style={[styles.ghostBtn, { marginTop: 12 }]} onPress={() => setAddModalOpen(true)}>
                  <Text style={styles.ghostBtnText}>Add your first item</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.listWrap}>
              {dailyInventory.map((item, idx) => renderInventoryItem(item, idx, dailyInventory.length))}
            </View>
          )}
        </View>
      )}

      {/* Permanent Stock Tab */}
      {activeTab === "permanent" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Permanent Stock</Text>
            <Pressable style={styles.iconBtn} onPress={() => setRestockModalOpen(true)}>
              <Feather name="refresh-cw" size={18} color={tone.success} />
              <Text style={{ color: tone.success, marginLeft: 4 }}>Restock</Text>
            </Pressable>
          </View>
          <Text style={styles.subtle}>Bulk stock items</Text>

          {permanentStock.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="archive" size={40} color="#d1d5db" />
              <Text style={[styles.subtle, { marginTop: 8 }]}>No permanent items in stock</Text>
              <Pressable style={[styles.ghostBtn, { marginTop: 12 }]} onPress={() => setRestockModalOpen(true)}>
                <Text style={styles.ghostBtnText}>Restock permanent items</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {permanentStock.map((item, idx) => renderInventoryItem(item, idx, permanentStock.length))}
            </View>
          )}
        </View>
      )}

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

      {/* Add to Daily Inventory Modal */}
      <Modal transparent animationType="slide" visible={addModalOpen} onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Daily Inventory</Text>
            <Pressable onPress={() => setAddModalOpen(false)}>
              <Feather name="x" size={22} />
            </Pressable>
          </View>

          <Pressable style={styles.inputLike} onPress={() => setFoodPickerOpen(true)}>
            <Text style={selectedFood ? styles.inputValue : styles.inputPlaceholder}>
              {selectedFood ? selectedFood.name : "Select food item (temporary only)"}
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
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={addToDailyInventory} disabled={saving}>
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

      {/* Restock Permanent Stock Modal */}
      <Modal transparent animationType="slide" visible={restockModalOpen} onRequestClose={() => setRestockModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRestockModalOpen(false)} />
        <View style={[styles.modalCard, { maxHeight: "80%" }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Restock Permanent Items</Text>
            <Pressable onPress={() => setRestockModalOpen(false)}>
              <Feather name="x" size={22} />
            </Pressable>
          </View>

          {/* Restock Items List */}
          {restockItems.length > 0 && (
            <View style={styles.restockList}>
              <Text style={styles.label}>Items to Restock:</Text>
              {restockItems.map((item, idx) => {
                const food = foodItems.find(f => f._id === item.foodItemId);
                return (
                  <View key={idx} style={styles.restockItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listLeft}>{food?.name || "Unknown"}</Text>
                      <Text style={styles.subtleSmall}>Qty: {item.quantity}</Text>
                    </View>
                    <Pressable onPress={() => removeRestockItem(idx)}>
                      <Feather name="trash-2" size={18} color={tone.destructive} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add Restock Item Form */}
          <View style={styles.restockForm}>
            <Text style={styles.label}>Add Item to Restock:</Text>
            <Pressable style={styles.inputLike} onPress={() => setRestockPickerOpen(true)}>
              <Text style={selectedRestockFood ? styles.inputValue : styles.inputPlaceholder}>
                {selectedRestockFood ? selectedRestockFood.name : "Select permanent item"}
              </Text>
              <Feather name="chevron-down" size={18} color="#6b7280" />
            </Pressable>

            <View style={styles.restockInputRow}>
              <TextInput
                style={[styles.qtyInput, { flex: 1 }]}
                placeholder="Quantity"
                keyboardType="number-pad"
                value={restockQty}
                onChangeText={(t) => setRestockQty(t.replace(/[^\d]/g, ""))}
              />
              <Pressable style={styles.addBtnSmall} onPress={addRestockItem}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addBtnSmallText}>Add</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={submitRestock} disabled={saving || restockItems.length === 0}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Restock</Text>}
            </Pressable>

            <Pressable
              style={[styles.ghostBtn, { flex: 1 }]}
              onPress={() => {
                setRestockModalOpen(false);
                setRestockItems([]);
                setSelectedRestockFood(null);
                setRestockQty("");
              }}
            >
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal transparent animationType="fade" visible={deleteModalOpen} onRequestClose={() => setDeleteModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteModalOpen(false)} />
        <View style={styles.confirmModal}>
          <View style={styles.confirmModalHeader}>
            <Feather name="alert-triangle" size={24} color={tone.destructive} />
            <Text style={styles.confirmModalTitle}>Delete Item</Text>
          </View>
          
          <Text style={styles.confirmModalText}>
            Are you sure you want to delete "{itemToDelete?.name}" from {itemToDelete?.type === "daily" ? "daily inventory" : "permanent stock"}?
          </Text>
          <Text style={styles.confirmModalWarning}>
            This action cannot be undone.
          </Text>

          <View style={styles.confirmModalButtons}>
            <Pressable
              style={[styles.confirmModalBtn, styles.confirmModalCancelBtn]}
              onPress={() => setDeleteModalOpen(false)}
            >
              <Text style={styles.confirmModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmModalBtn, styles.confirmModalDeleteBtn]}
              onPress={deleteInventoryItem}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmModalDeleteText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Food Picker Modal for Daily Inventory */}
      <Modal transparent animationType="slide" visible={foodPickerOpen} onRequestClose={() => setFoodPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setFoodPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Food Item (Temporary Only)</Text>
            <Pressable onPress={() => setFoodPickerOpen(false)}>
              <Feather name="x" size={20} />
            </Pressable>
          </View>
          <ScrollView>
            {foodItems.filter(f => f.available && !f.isPermanent).map((item) => (
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

      {/* Food Picker Modal for Restock */}
      <Modal transparent animationType="slide" visible={restockPickerOpen} onRequestClose={() => setRestockPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setRestockPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Permanent Item</Text>
            <Pressable onPress={() => setRestockPickerOpen(false)}>
              <Feather name="x" size={20} />
            </Pressable>
          </View>
          <ScrollView>
            {foodItems.filter(f => f.available && f.isPermanent).map((item) => (
              <Pressable
                key={item._id}
                style={styles.optionRow}
                onPress={() => {
                  setSelectedRestockFood(item);
                  setRestockPickerOpen(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: "#111827" }}>{item.name}</Text>
                  <Text style={styles.subtleSmall}>Category: {item.category}</Text>
                </View>
                <Text style={styles.subtleSmall}>
                  Current Stock: {permanentStock.find(s => s.foodItem === item._id)?.quantity || 0}
                </Text>
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

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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

  // Tabs
  tabContainer: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#eef1f5",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#eff6ff",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },

  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
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

  // Confirmation Modal
  confirmModal: {
    position: "absolute",
    left: 32,
    right: 32,
    top: "40%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  confirmModalText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
    lineHeight: 20,
  },
  confirmModalWarning: {
    fontSize: 12,
    color: tone.destructive,
    marginBottom: 20,
  },
  confirmModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  confirmModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmModalCancelBtn: {
    backgroundColor: "#f3f4f6",
  },
  confirmModalCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  confirmModalDeleteBtn: {
    backgroundColor: tone.destructive,
  },
  confirmModalDeleteText: {
    color: "#fff",
    fontWeight: "600",
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

  // Restock specific styles
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  restockList: {
    marginBottom: 16,
    maxHeight: 200,
  },
  restockItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
  },
  restockForm: {
    marginBottom: 16,
    gap: 8,
  },
  restockInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addBtnSmall: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addBtnSmallText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
});