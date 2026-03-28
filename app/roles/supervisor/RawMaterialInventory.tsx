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
type StockStatus = "out_of_stock" | "available";

interface RawMaterial {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  preferredSupplier: string;
  averageCost: number;
  stockStatus: StockStatus;
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
const getStatusColors = (status: StockStatus) => {
  switch (status) {
    case "out_of_stock":
      return { bg: "#fee2e2", fg: "#991b1b" };
    default:
      return { bg: "#dcfce7", fg: "#166534" };
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

  // Stock add modal
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedMaterialForStock, setSelectedMaterialForStock] =
    useState<RawMaterial | null>(null);
  const [addStockValue, setAddStockValue] = useState("");
  const [stockReason, setStockReason] = useState("");

  // Form state for adding from food item
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    unit: "",
    qty: "",
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    unit: "",
    preferredSupplier: "",
    averageCost: "0",
    addQty: "",
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

  // ----- Quick Add from Food Item -----
  const resetQuickAdd = () => {
    setQuickAddForm({
      name: "",
      unit: "",
      qty: "",
    });
  };

  const openQuickAdd = (material: FoodItemMaterial) => {
    setQuickAddForm({
      name: material.name,
      unit: material.unit,
      qty: "",
    });
    setAddModalVisible(true);
  };

  const handleQuickCreate = async () => {
    const qty = parseFloat(quickAddForm.qty) || 0;

    if (qty <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid quantity.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/api/raw-materials", {
        method: "POST",
        body: JSON.stringify({
          name: quickAddForm.name,
          qty,
        }),
      });

      Alert.alert("Success", `${quickAddForm.name} stock added successfully.`);
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

  // ----- Edit Material -----
  const openEditModal = (material: RawMaterial) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      category: material.category || "",
      unit: material.unit || "",
      preferredSupplier: material.preferredSupplier || "",
      averageCost: material.averageCost?.toString?.() || "0",
      addQty: "",
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingMaterial) return;
    setSaving(true);

    try {
      const metadataPayload: any = {};

      if (editForm.name !== editingMaterial.name) {
        metadataPayload.name = editForm.name;
      }

      if (editForm.category !== editingMaterial.category) {
        metadataPayload.category = editForm.category;
      }

      if (editForm.unit !== editingMaterial.unit) {
        metadataPayload.unit = editForm.unit;
      }

      if (editForm.preferredSupplier !== editingMaterial.preferredSupplier) {
        metadataPayload.preferredSupplier = editForm.preferredSupplier;
      }

      if (parseFloat(editForm.averageCost || "0") !== editingMaterial.averageCost) {
        metadataPayload.averageCost = parseFloat(editForm.averageCost || "0");
      }

      const addQty = parseFloat(editForm.addQty || "0");
      const stockChanged = !isNaN(addQty) && addQty > 0;

      if (Object.keys(metadataPayload).length > 0) {
        await apiRequest(`/api/raw-materials/${editingMaterial._id}`, {
          method: "PATCH",
          body: JSON.stringify(metadataPayload),
        });
      }

      if (stockChanged) {
        await apiRequest(`/api/raw-materials/${editingMaterial._id}/stock`, {
          method: "PATCH",
          body: JSON.stringify({
            qty: addQty,
            reason: "Added from edit modal",
            averageCost:
              editForm.averageCost !== ""
                ? parseFloat(editForm.averageCost)
                : undefined,
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

  // ----- Stock Add Modal -----
  const openStockModal = (material: RawMaterial) => {
    setSelectedMaterialForStock(material);
    setAddStockValue("");
    setStockReason("");
    setStockModalVisible(true);
  };

  const handleStockUpdate = async () => {
    if (!selectedMaterialForStock) return;

    const qty = parseFloat(addStockValue);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid input", "Please enter a valid quantity.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/raw-materials/${selectedMaterialForStock._id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({
          qty,
          reason: stockReason.trim() || "Manual stock add",
        }),
      });

      setStockModalVisible(false);
      fetchMaterials();
      Alert.alert(
        "Success",
        `${qty} ${selectedMaterialForStock.unit} added to ${selectedMaterialForStock.name}.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeStockModal = () => {
    setStockModalVisible(false);
    setSelectedMaterialForStock(null);
    setAddStockValue("");
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

  const outOfStockItems = materials.filter((i) => i.stockStatus === "out_of_stock");

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
        <Text style={[styles.muted, { marginTop: 8, textAlign: "center" }]}>
          {error}
        </Text>
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
          <Text style={styles.muted}>Manage stock from recipe raw materials</Text>
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
            These materials are used in your recipes. Select one and add quantity to
            inventory.
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

      {/* Out of Stock */}
      {outOfStockItems.length > 0 && (
        <Card style={{ borderColor: "#fecaca" }}>
          <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
            <View style={styles.rowCenter}>
              <Feather name="alert-triangle" size={18} color="#b91c1c" />
              <Text style={[styles.cardTitle, { color: "#b91c1c", marginLeft: 8 }]}>
                Out of Stock
              </Text>
            </View>
            <Text style={styles.cardDesc}>
              {outOfStockItems.length} item
              {outOfStockItems.length > 1 ? "s are" : " is"} out of stock
            </Text>
          </View>

          <View style={{ padding: 12, gap: 8 }}>
            {outOfStockItems.map((item) => (
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
                  <Text style={{ fontWeight: "700", color: "#111827" }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>
                    Current stock: {item.currentStock} {item.unit}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openStockModal(item)}
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: "#dc2626" },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Feather name="plus-circle" size={14} color="#fff" />
                  <Text style={[styles.btnText, { color: "#fff" }]}>Add Stock</Text>
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
              const pct = item.currentStock > 0 ? 100 : 0;
              const barColor =
                item.stockStatus === "out_of_stock" ? "#dc2626" : "#16a34a";

              return (
                <View key={item._id} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <View>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemCat}>{item.category || "Other"}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Badge label={item.stockStatus} bg={sc.bg} fg={sc.fg} />
                      <Pressable onPress={() => openEditModal(item)} hitSlop={10}>
                        <Feather name="edit-2" size={16} color="#6b7280" />
                      </Pressable>
                      <Pressable onPress={() => openStockModal(item)} hitSlop={10}>
                        <Feather name="plus-circle" size={16} color="#6b7280" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(item._id, item.name)}
                        hitSlop={10}
                      >
                        <Feather name="trash-2" size={16} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.small}>Stock Level</Text>
                      <Text style={styles.small}>
                        {item.currentStock} {item.unit}
                      </Text>
                    </View>
                    <ProgressBar value={pct} color={barColor} />
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Supplier</Text>
                      <Text style={styles.metaValue}>
                        {item.preferredSupplier || "—"}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Cost per {item.unit}</Text>
                      <Text style={styles.metaValue}>
                        ${Number(item.averageCost || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Status</Text>
                      <Text style={styles.metaValue}>{item.stockStatus}</Text>
                    </View>
                  </View>

                  {item.stockStatus === "out_of_stock" && (
                    <View
                      style={{
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: "#e5e7eb",
                      }}
                    >
                      <Pressable
                        onPress={() => openStockModal(item)}
                        style={({ pressed }) => [
                          styles.btn,
                          {
                            alignSelf: "flex-start",
                            backgroundColor: "#dc2626",
                          },
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Feather name="plus-circle" size={14} color="#fff" />
                        <Text style={[styles.btnText, { color: "#fff" }]}>
                          Add Stock
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

      {/* Modal for Quick Add */}
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
                  <Text style={styles.label}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    value={quickAddForm.qty}
                    onChangeText={(text) =>
                      setQuickAddForm({ ...quickAddForm, qty: text })
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
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Add to Inventory
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal for Edit Material */}
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
              <Text style={styles.modalDesc}>Update details and optionally add stock</Text>
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
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, category: text })
                    }
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
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, preferredSupplier: text })
                    }
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
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, averageCost: text })
                    }
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Add Stock Qty</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editForm.addQty}
                    onChangeText={(text) => setEditForm({ ...editForm, addQty: text })}
                    placeholder="Optional"
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
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal for Direct Stock Add */}
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
              <Text style={styles.modalTitle}>Add Stock</Text>
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
                  <Text style={styles.label}>Add Stock Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={addStockValue}
                    onChangeText={setAddStockValue}
                    placeholder="Enter quantity to add"
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
                    placeholder="e.g., purchase, correction"
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
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Add Stock
                  </Text>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 24, fontWeight: "700", color: "#111827" },
  muted: { color: "#6b7280", marginTop: 2 },
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
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnText: { fontWeight: "800", letterSpacing: 0.3 },
  progressBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
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
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemCat: { color: "#6b7280", fontSize: 12 },
  smallHint: { fontSize: 11, color: "#9ca3af" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: "86%",
  },
  modalHeader: { marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalDesc: { color: "#6b7280" },
  modalScroll: {},
  modalContent: { gap: 12, paddingBottom: 8 },
  formRow: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  btnOutline: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "#d1d5db",
  },
  btnSolid: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#111827",
    borderRadius: 10,
  },
});