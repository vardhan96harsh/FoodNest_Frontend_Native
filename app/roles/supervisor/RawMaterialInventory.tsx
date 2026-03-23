// app/features/inventory/RawMaterialInventory.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_BASE_URL as API_URL } from "@/constants/env";

// ==================== Types ====================
type StockStatus = "critical" | "low" | "adequate";

interface RawMaterial {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  preferredSupplier: string;
  averageCost: number;
  stockStatus: StockStatus;
  reorderQuantity: number;
}

interface FoodItemMaterial {
  name: string;
  unit: string;
  count: number;
}

const UNIT_OPTIONS = ["kg", "g", "liter", "ml", "piece", "packet", "dozen"];

// ==================== API Helper ====================
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem("token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = await response.json();
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "You don't have permission to perform this action. Please log in with a supervisor or admin account."
      );
    }
    throw new Error(json.error || "Request failed");
  }
  return json;
}

// ==================== Helpers ====================
const getStockPercentage = (current: number, max: number) =>
  max > 0 ? (current / max) * 100 : 0;

const getStatusColors = (status: StockStatus) => {
  switch (status) {
    case "critical":
      return { bg: "#fee2e2", fg: "#991b1b" };
    case "low":
      return { bg: "#fef3c7", fg: "#92400e" };
    default:
      return { bg: "#e5e7eb", fg: "#374151" };
  }
};

// ==================== UI Components ====================
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.progressBg}>
      <View
        style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]}
      />
    </View>
  );
}

// ==================== Main Screen ====================
export default function RawMaterialInventory() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [foodItemMaterials, setFoodItemMaterials] = useState<FoodItemMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFoodItems, setLoadingFoodItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  // Stock adjustment modal (optional, kept for direct adjustment)
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedMaterialForStock, setSelectedMaterialForStock] = useState<RawMaterial | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockReason, setStockReason] = useState("");

  // Form state for adding from food item
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    unit: "",
    currentStock: "0",
    category: "Other",
  });

  // Form state for editing (now includes currentStock)
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    unit: "",
    preferredSupplier: "",
    averageCost: "0",
    currentStock: "0", // <-- added
  });
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  // Fetch existing raw materials
  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ ok: boolean; items: RawMaterial[] }>(
        "/api/raw-materials"
      );
      setMaterials(data.items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch raw materials from food items
  const fetchFoodItemMaterials = async () => {
    setLoadingFoodItems(true);
    try {
      const data = await apiRequest<{
        ok: boolean;
        materials: FoodItemMaterial[];
      }>("/api/raw-materials/from-food-items");
      setFoodItemMaterials(data.materials);
    } catch (err) {
      console.error("Failed to fetch food item materials", err);
    } finally {
      setLoadingFoodItems(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchFoodItemMaterials();
  }, []);

  // ----- Quick Add from Food Item (with duplicate check) -----
  const resetQuickAdd = () => {
    setQuickAddForm({
      name: "",
      unit: "",
      currentStock: "0",
      category: "Other",
    });
  };

  const openQuickAdd = (material: FoodItemMaterial) => {
    setQuickAddForm({
      name: material.name,
      unit: material.unit,
      currentStock: "0",
      category: "Other",
    });
    setAddModalVisible(true);
  };

  const handleQuickCreate = async () => {
    const newStock = parseFloat(quickAddForm.currentStock) || 0;
    if (newStock <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid stock quantity.");
      return;
    }

    setSaving(true);
    try {
      // Check if material already exists in inventory (case-insensitive)
      const existing = materials.find(
        (m) => m.name.toLowerCase() === quickAddForm.name.toLowerCase()
      );

      if (existing) {
        // Update existing material: add the new stock to current stock
        const updatedStock = existing.currentStock + newStock;
        await apiRequest(`/api/raw-materials/${existing._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            currentStock: updatedStock,
            category: quickAddForm.category,
          }),
        });
        Alert.alert(
          "Stock Updated",
          `Added ${newStock} ${quickAddForm.unit} to ${existing.name}. New stock: ${updatedStock} ${existing.unit}`
        );
      } else {
        // Create new material
        const payload = {
          name: quickAddForm.name,
          category: quickAddForm.category,
          unit: quickAddForm.unit,
          currentStock: newStock,
        };
        await apiRequest("/api/raw-materials", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        Alert.alert("Success", `${quickAddForm.name} added to inventory.`);
      }
      closeAddModal();
      fetchMaterials();
      fetchFoodItemMaterials();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    resetQuickAdd();
  };

  // ----- Edit Material (now includes stock) -----
  const openEditModal = (material: RawMaterial) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      category: material.category,
      unit: material.unit,
      preferredSupplier: material.preferredSupplier,
      averageCost: material.averageCost.toString(),
      currentStock: material.currentStock.toString(), // <-- prefill
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingMaterial) return;
    setSaving(true);
    try {
      // 1. Metadata updates (name, category, unit, supplier, cost)
      const metadataPayload: any = {};
      if (editForm.name !== editingMaterial.name) metadataPayload.name = editForm.name;
      if (editForm.category !== editingMaterial.category) metadataPayload.category = editForm.category;
      if (editForm.unit !== editingMaterial.unit) metadataPayload.unit = editForm.unit;
      if (editForm.preferredSupplier !== editingMaterial.preferredSupplier)
        metadataPayload.preferredSupplier = editForm.preferredSupplier;
      if (parseFloat(editForm.averageCost) !== editingMaterial.averageCost)
        metadataPayload.averageCost = parseFloat(editForm.averageCost);

      // 2. Stock update
      const newStock = parseFloat(editForm.currentStock);
      const stockChanged = !isNaN(newStock) && newStock !== editingMaterial.currentStock;

      // Perform metadata update if needed
      if (Object.keys(metadataPayload).length > 0) {
        await apiRequest(`/api/raw-materials/${editingMaterial._id}`, {
          method: "PATCH",
          body: JSON.stringify(metadataPayload),
        });
      }

      // Perform stock adjustment if needed
      if (stockChanged) {
        await apiRequest(`/api/raw-materials/${editingMaterial._id}/stock`, {
          method: "PATCH",
          body: JSON.stringify({
            newStock,
            reason: "Edited from Edit modal",
            notes: undefined,
          }),
        });
      }

      if (Object.keys(metadataPayload).length === 0 && !stockChanged) {
        Alert.alert("No changes", "Nothing to update");
        closeEditModal();
        return;
      }

      closeEditModal();
      fetchMaterials();
      Alert.alert("Success", `${editForm.name} updated.`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingMaterial(null);
    setShowUnitDropdown(false);
  };

  // ----- Stock Adjustment Modal (direct adjustment) -----
  const openStockModal = (material: RawMaterial) => {
    setSelectedMaterialForStock(material);
    setNewStockValue(material.currentStock.toString());
    setStockReason("");
    setStockModalVisible(true);
  };

  const handleStockUpdate = async () => {
    if (!selectedMaterialForStock) return;
    const newStock = parseFloat(newStockValue);
    if (isNaN(newStock)) {
      Alert.alert("Invalid input", "Please enter a valid number for stock.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/raw-materials/${selectedMaterialForStock._id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({
          newStock,
          reason: stockReason.trim() || "Manual adjustment",
          notes: stockReason.trim() || undefined,
        }),
      });
      setStockModalVisible(false);
      fetchMaterials();
      Alert.alert("Success", `Stock for ${selectedMaterialForStock.name} updated to ${newStock} ${selectedMaterialForStock.unit}.`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeStockModal = () => {
    setStockModalVisible(false);
    setSelectedMaterialForStock(null);
    setNewStockValue("");
    setStockReason("");
  };

  // ----- Delete Material -----
  const handleDelete = async (id: string, name: string) => {
    Alert.alert("Delete Material", `Are you sure you want to delete ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/raw-materials/${id}`, { method: "DELETE" });
            fetchMaterials();
            fetchFoodItemMaterials();
            Alert.alert("Deleted", `${name} removed`);
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const handleReorder = (item: RawMaterial) => {
    Alert.alert(
      "Reorder",
      `Reorder request for ${item.reorderQuantity} ${item.unit} of ${item.name} has been sent to procurement.`
    );
  };

  const criticalItems = materials.filter((i) => i.stockStatus === "critical");
  const lowStockItems = materials.filter((i) => i.stockStatus === "low");

  // ----- Render -----
  if (loading && materials.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.muted}>Loading inventory...</Text>
      </View>
    );
  }

  if (error && materials.length === 0) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text style={[styles.muted, { marginTop: 8, textAlign: "center" }]}>{error}</Text>
        <Pressable onPress={fetchMaterials} style={styles.retryBtn}>
          <Text style={{ color: "#fff" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Raw Material Inventory</Text>
          <Text style={styles.muted}>Monitor stock levels and manage reorders</Text>
        </View>
      </View>

      {/* SECTION: Raw Materials from Food Items */}
      <Card>
        <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
          <View style={styles.rowCenter}>
            <Feather name="shopping-bag" size={18} color="#111827" />
            <Text style={[styles.cardTitle, { marginLeft: 8 }]}>From Food Items</Text>
          </View>
          <Text style={styles.cardDesc}>
            These materials are used in your recipes. Add them to inventory with an initial quantity.
          </Text>
        </View>

        {loadingFoodItems ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : foodItemMaterials.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Feather name="coffee" size={40} color="#9CA3AF" />
            <Text style={styles.muted}>No materials found in any food item.</Text>
            <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>
              Add raw materials to your food items first.
            </Text>
          </View>
        ) : (
          <View style={{ padding: 12, gap: 12 }}>
            {foodItemMaterials.map((mat) => (
              <View key={mat.name} style={styles.foodItemMaterialCard}>
                <View style={styles.itemTopRow}>
                  <View>
                    <Text style={styles.itemTitle}>{mat.name}</Text>
                    <Text style={styles.itemCat}>Unit: {mat.unit}</Text>
                  </View>
                  <Pressable
                    onPress={() => openQuickAdd(mat)}
                    style={({ pressed }) => [
                      styles.addToInventoryBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Feather name="plus-circle" size={16} color="#fff" />
                    <Text style={styles.addToInventoryBtnText}>Add to Inventory</Text>
                  </Pressable>
                </View>
                <Text style={styles.smallHint}>
                  Used in {mat.count} food item{mat.count > 1 ? "s" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Critical Alerts */}
      {criticalItems.length > 0 && (
        <Card style={{ borderColor: "#fecaca" }}>
          <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
            <View style={styles.rowCenter}>
              <Feather name="alert-triangle" size={18} color="#b91c1c" />
              <Text style={[styles.cardTitle, { color: "#b91c1c", marginLeft: 8 }]}>
                Critical Stock Alerts
              </Text>
            </View>
            <Text style={styles.cardDesc}>
              {criticalItems.length} item{criticalItems.length > 1 ? "s" : ""} require immediate attention
            </Text>
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            {criticalItems.map((item) => (
              <View
                key={item._id}
                style={{
                  backgroundColor: "#fee2e2",
                  padding: 10,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontWeight: "700", color: "#111827" }}>{item.name}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>
                    Only {item.currentStock} {item.unit} remaining (Min: {item.minimumStock}{" "}
                    {item.unit})
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleReorder(item)}
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: "#dc2626" },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Feather name="shopping-cart" size={14} color="#fff" />
                  <Text style={[styles.btnText, { color: "#fff" }]}>Reorder Now</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Low Stock */}
      {lowStockItems.length > 0 && (
        <Card>
          <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
            <View style={styles.rowCenter}>
              <Feather name="trending-down" size={18} color="#b45309" />
              <Text style={[styles.cardTitle, { marginLeft: 8 }]}>Low Stock Items</Text>
            </View>
            <Text style={styles.cardDesc}>
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} approaching minimum stock levels
            </Text>
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            {lowStockItems.map((item) => (
              <View
                key={item._id}
                style={{
                  backgroundColor: "#fef3c7",
                  padding: 10,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontWeight: "700", color: "#111827" }}>{item.name}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>
                    {item.currentStock} {item.unit} remaining (Min: {item.minimumStock}{" "}
                    {item.unit})
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleReorder(item)}
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: "#e5e7eb" },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Feather name="shopping-cart" size={14} color="#111827" />
                  <Text style={[styles.btnText, { color: "#111827" }]}>Reorder</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Full Inventory */}
      <Card>
        <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
          <View style={styles.rowCenter}>
            <Feather name="box" size={18} color="#111827" />
            <Text style={[styles.cardTitle, { marginLeft: 8 }]}>Complete Inventory</Text>
          </View>
        </View>

        {materials.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Feather name="package" size={40} color="#9CA3AF" />
            <Text style={styles.muted}>No materials in inventory yet.</Text>
            <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>
              Use the "From Food Items" section above to add materials.
            </Text>
          </View>
        ) : (
          <View style={{ padding: 12, gap: 12 }}>
            {materials.map((item) => {
              const sc = getStatusColors(item.stockStatus);
              const pct = getStockPercentage(item.currentStock, item.maximumStock);
              const barColor =
                item.stockStatus === "critical"
                  ? "#dc2626"
                  : item.stockStatus === "low"
                  ? "#b45309"
                  : "#16a34a";

              return (
                <View key={item._id} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <View>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemCat}>{item.category}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Badge label={item.stockStatus} bg={sc.bg} fg={sc.fg} />
                      <Pressable onPress={() => openEditModal(item)} hitSlop={10}>
                        <Feather name="edit-2" size={16} color="#6b7280" />
                      </Pressable>
                      <Pressable onPress={() => openStockModal(item)} hitSlop={10}>
                        <Feather name="sliders" size={16} color="#6b7280" />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(item._id, item.name)} hitSlop={10}>
                        <Feather name="trash-2" size={16} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.small}>Stock Level</Text>
                      <Text style={styles.small}>
                        {item.currentStock}/{item.maximumStock} {item.unit}
                      </Text>
                    </View>
                    <ProgressBar value={pct} color={barColor} />
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Supplier</Text>
                      <Text style={styles.metaValue}>{item.preferredSupplier || "—"}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Cost per {item.unit}</Text>
                      <Text style={styles.metaValue}>${item.averageCost.toFixed(2)}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Reorder Qty</Text>
                      <Text style={styles.metaValue}>
                        {item.reorderQuantity} {item.unit}
                      </Text>
                    </View>
                  </View>

                  {(item.stockStatus === "critical" || item.stockStatus === "low") && (
                    <View
                      style={{
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: "#e5e7eb",
                      }}
                    >
                      <Pressable
                        onPress={() => handleReorder(item)}
                        style={({ pressed }) => [
                          styles.btn,
                          {
                            alignSelf: "flex-start",
                            backgroundColor:
                              item.stockStatus === "critical" ? "#dc2626" : "#e5e7eb",
                          },
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Feather
                          name="shopping-cart"
                          size={14}
                          color={item.stockStatus === "critical" ? "#fff" : "#111827"}
                        />
                        <Text
                          style={[
                            styles.btnText,
                            {
                              color:
                                item.stockStatus === "critical" ? "#fff" : "#111827",
                            },
                          ]}
                        >
                          Reorder {item.reorderQuantity} {item.unit}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Modal for Quick Add (from Food Item) */}
      <Modal
        transparent
        visible={addModalVisible}
        animationType="slide"
        onRequestClose={closeAddModal}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Inventory</Text>
              <Text style={styles.modalDesc}>
                {quickAddForm.name} ({quickAddForm.unit})
              </Text>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Current Stock *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    value={quickAddForm.currentStock}
                    onChangeText={(text) =>
                      setQuickAddForm({ ...quickAddForm, currentStock: text })
                    }
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Meat, Vegetables"
                    value={quickAddForm.category}
                    onChangeText={(text) =>
                      setQuickAddForm({ ...quickAddForm, category: text })
                    }
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={closeAddModal} style={styles.btnOutline} disabled={saving}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleQuickCreate}
                style={styles.btnSolid}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>Add to Inventory</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal for Edit Material (now includes stock) */}
      <Modal
        transparent
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Material</Text>
              <Text style={styles.modalDesc}>Update material details and stock</Text>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.name}
                    onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.category}
                    onChangeText={(text) => setEditForm({ ...editForm, category: text })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Unit</Text>
                  <View style={{ position: "relative", zIndex: 10 }}>
                    <Pressable
                      onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                      style={styles.unitBox}
                    >
                      <Text style={{ color: editForm.unit ? "#111827" : "#9ca3af" }}>
                        {editForm.unit || "Select unit"}
                      </Text>
                      <Feather
                        name={showUnitDropdown ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#6b7280"
                      />
                    </Pressable>
                    {showUnitDropdown && (
                      <View style={styles.unitDropdown}>
                        {UNIT_OPTIONS.map((unit) => (
                          <Pressable
                            key={unit}
                            onPress={() => {
                              setEditForm({ ...editForm, unit });
                              setShowUnitDropdown(false);
                            }}
                            style={styles.unitOption}
                          >
                            <Text style={styles.unitOptionText}>{unit}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Preferred Supplier</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.preferredSupplier}
                    onChangeText={(text) => setEditForm({ ...editForm, preferredSupplier: text })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Average Cost</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editForm.averageCost}
                    onChangeText={(text) => setEditForm({ ...editForm, averageCost: text })}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Current Stock</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editForm.currentStock}
                    onChangeText={(text) => setEditForm({ ...editForm, currentStock: text })}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={closeEditModal} style={styles.btnOutline} disabled={saving}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleUpdate} style={styles.btnSolid} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal for Direct Stock Adjustment (kept) */}
      <Modal
        transparent
        visible={stockModalVisible}
        animationType="slide"
        onRequestClose={closeStockModal}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Stock</Text>
              <Text style={styles.modalDesc}>
                {selectedMaterialForStock?.name} ({selectedMaterialForStock?.unit})
              </Text>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>New Stock Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={newStockValue}
                    onChangeText={setNewStockValue}
                    placeholder="Enter new stock amount"
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Reason (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={stockReason}
                    onChangeText={setStockReason}
                    placeholder="e.g., physical count, wastage, return"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={closeStockModal} style={styles.btnOutline} disabled={saving}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleStockUpdate} style={styles.btnSolid} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>Update Stock</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ==================== Styles ====================
const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32, gap: 16, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 24, fontWeight: "700", color: "#111827" },
  muted: { color: "#6b7280", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center" },
  addBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  addBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "600", marginLeft: 4 },
  retryBtn: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eceff3",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardDesc: { color: "#6b7280", fontSize: 12, marginTop: 4 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontWeight: "800", letterSpacing: 0.3 },
  progressBg: { height: 8, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999 },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: "#fff",
  },
  foodItemMaterialCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: "#fefce8",
  },
  itemTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemCat: { color: "#6b7280", fontSize: 12 },
  smallHint: { fontSize: 11, color: "#9ca3af" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  small: { fontSize: 12, color: "#111827" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  metaCol: { width: "48%", gap: 2 },
  metaLabel: { color: "#6b7280", fontSize: 12 },
  metaValue: { color: "#111827", fontWeight: "600" },
  addToInventoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addToInventoryBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12, maxHeight: "86%" },
  modalHeader: { marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalDesc: { color: "#6b7280" },
  modalScroll: {},
  modalContent: { gap: 12, paddingBottom: 8 },
  formRow: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontWeight: "600", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  unitBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  unitDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxHeight: 200,
    zIndex: 20,
    elevation: 10,
  },
  unitOption: { paddingVertical: 10, paddingHorizontal: 12 },
  unitOptionText: { fontSize: 14, color: "#111827" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 6 },
  btnOutline: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 10, borderColor: "#d1d5db" },
  btnSolid: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#111827", borderRadius: 10 },
});