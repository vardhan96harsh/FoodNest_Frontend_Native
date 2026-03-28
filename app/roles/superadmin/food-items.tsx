import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Image,
  Switch as RNSwitch,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native";

const UNIT_OPTIONS = ["ml", "L", "g", "kg", "piece", "packet"];

// API CONFIG
import { API_BASE_URL as API_URL } from "@/constants/env";

// Types
type Item = {
  _id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  tax?: number;
  imageUrl?: string | null;
  rawMaterials?: Array<{ name: string; qty?: number; unit?: string }>;
  isPermanent: boolean;
  originalPrice?: number;
  discount?: number;
  isDiscounted?: boolean;
};

const toINR = (thb: number) => Math.round(thb * 2.5);

export default function FoodItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [filterType, setFilterType] = useState<"all" | "permanent" | "temporary">("all");

  // form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [category, setCategory] = useState("");
  const [tax, setTax] = useState<string>("");
  const [available, setAvailable] = useState(true);
  const [isPermanent, setIsPermanent] = useState(false);
  const [picked, setPicked] = useState<{
    uri: string;
    type?: string;
    name?: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);

  const [openUnitIndex, setOpenUnitIndex] = useState<number | null>(null);
  const [rawMaterials, setRawMaterials] = useState<
    Array<{ name: string; qty: string; unit: string }>
  >([{ name: "", qty: "", unit: "" }]);

  function addRawMaterialRow() {
    setRawMaterials((arr) => [...arr, { name: "", qty: "", unit: "" }]);
  }
  
  function removeRawMaterialRow(idx: number) {
    setRawMaterials((arr) => arr.filter((_, i) => i !== idx));
  }
  
  function updateRawMaterial(
    idx: number,
    key: "name" | "qty" | "unit",
    val: string
  ) {
    setRawMaterials((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  const resetForm = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setOriginalPrice("");
    setDiscount("");
    setIsDiscounted(false);
    setCategory("");
    setTax("");
    setAvailable(true);
    setIsPermanent(false);
    setPicked(null);
    setRawMaterials([{ name: "", qty: "", unit: "" }]);
  };

  const openAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (it: Item) => {
    setEditing(it);
    setName(it.name);
    setPrice(String(it.price));
    setOriginalPrice(it.originalPrice ? String(it.originalPrice) : "");
    setDiscount(it.discount ? String(it.discount) : "");
    setIsDiscounted(it.isDiscounted || false);
    setCategory(it.category);
    setTax(it.tax ? String(it.tax) : "");
    setAvailable(it.available);
    setIsPermanent(it.isPermanent);

    if (it.rawMaterials && it.rawMaterials.length) {
      setRawMaterials(
        it.rawMaterials.map((r) => ({
          name: r.name || "",
          qty: r.qty !== undefined && r.qty !== null ? String(r.qty) : "",
          unit: r.unit || "",
        }))
      );
    } else {
      setRawMaterials([{ name: "", qty: "", unit: "" }]);
    }

    setIsAdding(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need media permission to choose a photo."
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.length) {
      const a = res.assets[0];
      setPicked({
        uri: a.uri,
        type: a.mimeType ?? "image/jpeg",
        name: a.fileName ?? "food.jpg",
        fileName: a.fileName ?? undefined,
        mimeType: a.mimeType ?? undefined,
      });
    }
  };

  // API helpers
  async function apiGet<T>(path: string): Promise<T> {
    const r = await fetch(`${API_URL}${path}`);
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as T;
  }
  
  async function apiSend<T>(
    path: string,
    method: string,
    body: any,
    isForm = false
  ): Promise<T> {
    const r = await fetch(`${API_URL}${path}`, {
      method,
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as T;
  }

  // Load items based on filter
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/api/foods";
      if (filterType === "permanent") {
        endpoint = "/api/foods/permanent";
      } else if (filterType === "temporary") {
        endpoint = "/api/foods/temporary";
      }
      
      const data = await apiGet<Item[]>(endpoint);
      console.log("FOODS RECEIVED:", data);
      setItems(data);
    } catch (e: any) {
      console.warn("API failed:", e?.message || e);
      setItems([]);
      setError(e?.message || "Failed to load food items from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterType]);

  function toFilePart(p: {
    uri: string;
    type?: string;
    name?: string;
    mimeType?: string;
    fileName?: string;
  }) {
    const uri = p.uri;
    const sourceName = p.fileName || p.name || "";
    const fromUri = uri.split("?")[0].split("#")[0];
    const rawLast = (sourceName || fromUri).split("/").pop() || "image.jpg";
    const hasExt = /\.[a-z0-9]+$/i.test(rawLast);
    const name = hasExt ? rawLast : `${rawLast}.jpg`;
    const ext = (name.split(".").pop() || "").toLowerCase();
    const type =
      p.mimeType ||
      p.type ||
      (ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : ext === "gif"
        ? "image/gif"
        : "image/jpeg");

    return { uri, name, type } as any;
  }

  async function appendPickedImage(
    fd: FormData,
    picked: {
      uri: string;
      type?: string;
      name?: string;
      mimeType?: string;
      fileName?: string;
    }
  ) {
    if (!picked) return;

    const part = toFilePart(picked);

    if (Platform.OS === "web") {
      const resp = await fetch(part.uri);
      const blob = await resp.blob();
      const file = new File([blob], part.name, {
        type: part.type || blob.type || "image/jpeg",
      });
      fd.append("image", file);
    } else {
      fd.append("image", part as any);
    }
  }

  const calculateDiscountedPrice = () => {
    if (isDiscounted && discount && originalPrice) {
      const disc = Number(discount);
      const orig = Number(originalPrice);
      if (disc > 0 && orig > 0) {
        return (orig * (1 - disc / 100)).toFixed(2);
      }
    }
    return price;
  };

  const save = async () => {
    const p = Number(price);
    const t = tax ? Number(tax) : undefined;
    
    if (!name.trim() || !category.trim() || Number.isNaN(p)) {
      Alert.alert("Please fill valid Name, Category and Price.");
      return;
    }

    // Validate discount fields
    if (isDiscounted) {
      const orig = Number(originalPrice);
      const disc = Number(discount);
      if (orig <= 0 || disc <= 0 || disc > 100) {
        Alert.alert("Invalid Discount", "Original price must be > 0 and discount must be between 1-100%");
        return;
      }
    }

    const cleanRawMaterials = rawMaterials
      .map((r) => ({
        name: r.name.trim(),
        qty: r.qty.trim() ? Number(r.qty.trim()) : undefined,
        unit: r.unit.trim() || undefined,
      }))
      .filter((r) => r.name.length > 0);

    setSaving(true);
    try {
      if (editing) {
        let updated: Item;
        if (picked) {
          const fd = new FormData();
          fd.append("name", name);
          fd.append("price", String(p));
          fd.append("category", category);
          if (t !== undefined && !isNaN(t)) fd.append("tax", String(t));
          fd.append("available", String(available));
          fd.append("isPermanent", String(isPermanent));
          fd.append("rawMaterials", JSON.stringify(cleanRawMaterials));
          
          // Add discount fields
          fd.append("isDiscounted", String(isDiscounted));
          if (isDiscounted) {
            fd.append("originalPrice", originalPrice);
            fd.append("discount", discount);
          }
          
          await appendPickedImage(fd, picked);
          updated = await apiSend<Item>(
            `/api/foods/${editing._id}`,
            "PATCH",
            fd,
            true
          );
        } else {
          const updateData: any = {
            name,
            price: p,
            category,
            tax: t,
            available,
            isPermanent,
            rawMaterials: cleanRawMaterials,
            isDiscounted,
          };
          
          if (isDiscounted) {
            updateData.originalPrice = Number(originalPrice);
            updateData.discount = Number(discount);
          } else {
            updateData.originalPrice = null;
            updateData.discount = 0;
          }
          
          updated = await apiSend<Item>(`/api/foods/${editing._id}`, "PATCH", updateData);
        }
        setItems((arr) =>
          arr.map((x) => (x._id === editing._id ? updated : x))
        );
      } else {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("price", String(p));
        fd.append("category", category);
        if (t !== undefined && !isNaN(t)) fd.append("tax", String(t));
        fd.append("available", String(available));
        fd.append("isPermanent", String(isPermanent));
        fd.append("rawMaterials", JSON.stringify(cleanRawMaterials));
        
        // Add discount fields
        fd.append("isDiscounted", String(isDiscounted));
        if (isDiscounted) {
          fd.append("originalPrice", originalPrice);
          fd.append("discount", discount);
        }
        
        if (picked) {
          await appendPickedImage(fd, picked);
        }
        
        const created = await apiSend<Item>("/api/foods", "POST", fd, true);
        setItems((arr) => [created, ...arr]);
      }
      setIsAdding(false);
      resetForm();
    } catch (e: any) {
      console.error("Save error:", e);
      Alert.alert("Save failed", e?.message || "Unable to save item");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (_id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiSend(`/api/foods/${_id}`, "DELETE", {});
              setItems((arr) => arr.filter((x) => x._id !== _id));
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message || "Unable to delete");
            }
          }
        }
      ]
    );
  };

  const renderPrice = (item: Item) => {
    if (item.isDiscounted && item.originalPrice && item.discount) {
      return (
        <View>
          <Text style={styles.price}>
            ฿{item.price.toFixed(2)}
          </Text>
          <Text style={styles.originalPrice}>
            ฿{item.originalPrice.toFixed(2)}
          </Text>
          <Text style={styles.discountBadge}>
            -{item.discount}%
          </Text>
        </View>
      );
    }
    return (
      <Text style={styles.price}>
        ฿{item.price.toFixed(2)}
        <Text style={styles.inr}> INR {toINR(item.price)}</Text>
      </Text>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Food Items</Text>
          <Text style={styles.muted}>Manage menu items and pricing</Text>
        </View>
        <Pressable onPress={openAdd} style={styles.addBtn}>
          <LinearGradient
            colors={["#FDE047", "#F59E0B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBtnGrad}
          >
            <Feather name="plus" size={16} color="#ffffff" />
            <Text style={styles.addBtnTextYellow}> Add Food Item</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Pressable 
          style={[styles.filterTab, filterType === "all" && styles.filterTabActive]}
          onPress={() => setFilterType("all")}
        >
          <Text style={[styles.filterText, filterType === "all" && styles.filterTextActive]}>
            All Items
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.filterTab, filterType === "permanent" && styles.filterTabActive]}
          onPress={() => setFilterType("permanent")}
        >
          <Text style={[styles.filterText, filterType === "permanent" && styles.filterTextActive]}>
            Permanent
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.filterTab, filterType === "temporary" && styles.filterTabActive]}
          onPress={() => setFilterType("temporary")}
        >
          <Text style={[styles.filterText, filterType === "temporary" && styles.filterTextActive]}>
            Temporary
          </Text>
        </Pressable>
      </View>

      {/* Loader or Error or Empty State or Items */}
      {loading ? (
        <View style={{ paddingVertical: 40 }}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 16 }}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={{ color: "#6b7280", textAlign: "center" }}>{error}</Text>
          <Pressable 
            onPress={load}
            style={styles.btnOutline}
          >
            <Text>Try Again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 16 }}>
          <Feather name="coffee" size={48} color="#9CA3AF" />
          <Text style={{ color: "#6b7280", textAlign: "center" }}>
            No food items found.{"\n"}
            Tap the "Add Food Item" button to create your first menu item.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {items.map((item) => (
            <View key={item._id} style={styles.cardRow}>
              {/* Image */}
              <View style={styles.thumbBox}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderBox}>
                    <Feather name="image" size={28} color="#9CA3AF" />
                    <Text style={styles.placeholderText}>No image</Text>
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDesc}>{item.category}</Text>
                  </View>
                  <View>
                    <View
                      style={[
                        styles.badge,
                        item.available ? styles.badgeOn : styles.badgeOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          item.available
                            ? styles.badgeTextOn
                            : styles.badgeTextOff,
                        ]}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </Text>
                    </View>
                    {item.isPermanent && (
                      <View style={[styles.badge, styles.permanentBadge, { marginTop: 4 }]}>
                        <Text style={styles.permanentBadgeText}>Permanent</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Raw materials */}
                {Array.isArray(item.rawMaterials) &&
                  item.rawMaterials.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.rmLabel}>Raw materials</Text>
                      <Text style={styles.rmText}>
                        {item.rawMaterials
                          .map(
                            (r) =>
                              `${r.name}${
                                r.qty
                                  ? ` (${r.qty}${r.unit ? r.unit : ""})`
                                  : ""
                              }`
                          )
                          .join(", ")}
                      </Text>
                    </View>
                  )}

                {/* Price + actions */}
                <View style={styles.cardFooterRow}>
                  <View>
                    {renderPrice(item)}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => openEdit(item)}
                    >
                      <Feather name="edit-2" size={18} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => remove(item._id)}
                    >
                      <Feather name="trash-2" size={18} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add/Edit modal */}
      <Modal
        transparent
        visible={isAdding}
        animationType="slide"
        onRequestClose={() => setIsAdding(false)}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? "Edit Food Item" : "Add New Food Item"}
              </Text>
              <Text style={styles.modalDesc}>Create a new menu item</Text>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Food Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter food name"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Category *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Snacks, Beverages"
                    value={category}
                    onChangeText={setCategory}
                  />
                </View>
              </View>

              {/* Price Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing</Text>
                
                <View style={styles.formRow}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Price (฿) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={price}
                      onChangeText={setPrice}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Tax / VAT (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 5"
                      keyboardType="number-pad"
                      value={tax}
                      onChangeText={setTax}
                    />
                  </View>
                </View>

                {/* Discount Toggle */}
                <View style={[styles.formRow, { alignItems: "center", marginTop: 8 }]}>
                  <View style={[styles.field, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <RNSwitch value={isDiscounted} onValueChange={setIsDiscounted} />
                    <Text style={styles.label}>Apply Discount</Text>
                  </View>
                </View>

                {/* Discount Fields */}
                {isDiscounted && (
                  <View style={styles.formRow}>
                    <View style={styles.field}>
                      <Text style={styles.label}>Original Price (฿)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Original price"
                        keyboardType="decimal-pad"
                        value={originalPrice}
                        onChangeText={setOriginalPrice}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Discount (%)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 10"
                        keyboardType="number-pad"
                        value={discount}
                        onChangeText={setDiscount}
                      />
                    </View>
                  </View>
                )}

                {isDiscounted && originalPrice && discount && (
                  <View style={styles.discountPreview}>
                    <Text style={styles.discountPreviewText}>
                      Final Price: ฿{calculateDiscountedPrice()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Status</Text>
                <View style={[styles.formRow, { alignItems: "center" }]}>
                  <View style={[styles.field, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <RNSwitch value={available} onValueChange={setAvailable} />
                    <Text style={styles.label}>Available</Text>
                  </View>
                  <View style={[styles.field, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <RNSwitch value={isPermanent} onValueChange={setIsPermanent} />
                    <Text style={styles.label}>Permanent Item</Text>
                  </View>
                </View>
              </View>

              {/* Raw Materials */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Raw Materials</Text>
                {rawMaterials.map((rm, idx) => (
                  <View key={idx} style={styles.rawMaterialRow}>
                    <View style={{ flex: 2 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="Material name"
                        value={rm.name}
                        onChangeText={(v) => updateRawMaterial(idx, "name", v)}
                      />
                    </View>
                    <View style={{ width: 80 }}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Qty"
                        value={rm.qty}
                        onChangeText={(v) => updateRawMaterial(idx, "qty", v)}
                      />
                    </View>
                    <View style={{ width: 100, position: "relative", zIndex: openUnitIndex === idx ? 100 : 1 }}>
                      <Pressable
                        onPress={() => setOpenUnitIndex(openUnitIndex === idx ? null : idx)}
                        style={styles.unitBox}
                      >
                        <Text style={{ color: rm.unit ? "#111827" : "#9ca3af", fontSize: 14 }}>
                          {rm.unit || "Select unit"}
                        </Text>
                        <Feather name={openUnitIndex === idx ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
                      </Pressable>
                      {openUnitIndex === idx && (
                        <View style={styles.unitDropdown}>
                          {UNIT_OPTIONS.map((u) => (
                            <Pressable
                              key={u}
                              onPress={() => {
                                updateRawMaterial(idx, "unit", u);
                                setOpenUnitIndex(null);
                              }}
                              style={styles.unitOption}
                            >
                              <Text style={styles.unitOptionText}>{u}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                    <Pressable onPress={() => removeRawMaterialRow(idx)} style={styles.iconBtn}>
                      <Feather name="minus" size={18} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={addRawMaterialRow} style={styles.addMaterialBtn}>
                  <Feather name="plus" size={16} color="#F59E0B" />
                  <Text style={styles.addMaterialText}>Add Material</Text>
                </Pressable>
              </View>

              {/* Upload area */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Food Image</Text>
                <Pressable style={styles.uploadBox} onPress={pickImage}>
                  {picked ? (
                    <Image
                      source={{ uri: picked.uri }}
                      style={{ width: "100%", height: 160, borderRadius: 10 }}
                    />
                  ) : (
                    <>
                      <Feather name="upload" size={28} color="#6b7280" />
                      <Text style={{ color: "#6b7280", marginTop: 6 }}>
                        Tap to upload or pick from gallery
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                        PNG, JPG up to 10MB
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setIsAdding(false);
                  resetForm();
                }}
                style={styles.btnOutline}
                disabled={saving}
              >
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={save}
                style={styles.btnSolid}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Save Item
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

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 24, fontWeight: "700" },
  muted: { color: "#6b7280" },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
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
  addBtnTextYellow: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Filter tabs
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  filterTabActive: {
    backgroundColor: "#F59E0B",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  filterTextActive: {
    color: "#ffffff",
  },

  // Card styles
  cardRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  thumbBox: {
    width: 84,
    height: 84,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  cardBody: {
    flex: 1,
    minHeight: 84,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDesc: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  cardFooterRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  
  // Price styles
  price: { fontSize: 18, fontWeight: "700", color: "#111827" },
  inr: { marginLeft: 4, color: "#6b7280", fontSize: 12 },
  originalPrice: { fontSize: 12, color: "#9ca3af", textDecorationLine: "line-through" },
  discountBadge: { fontSize: 12, color: "#10b981", fontWeight: "600", marginTop: 2 },
  
  // Badges
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeOn: { backgroundColor: "#10b98122", borderColor: "#10b98155" },
  badgeOff: { backgroundColor: "#e5e7eb", borderColor: "#d1d5db" },
  badgeText: { fontSize: 10, fontWeight: "600" },
  badgeTextOn: { color: "#065f46" },
  badgeTextOff: { color: "#374151" },
  permanentBadge: { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" },
  permanentBadgeText: { fontSize: 10, fontWeight: "600", color: "#F59E0B" },
  
  // Actions
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#d1d5db",
  },
  
  // Modal styles
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  
  // Form styles
  formRow: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontWeight: "600", color: "#374151", fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  
  // Sections
  section: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  
  // Raw materials
  rawMaterialRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  rmLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    opacity: 0.8,
  },
  rmText: {
    color: "#6b7280",
    marginTop: 2,
    fontSize: 12,
  },
  unitBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  unitDropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    width: 120,
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#d1d5db",
    zIndex: 100,
    elevation: 12,
  },
  unitOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  unitOptionText: {
    fontSize: 14,
    color: "#111827",
  },
  addMaterialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  addMaterialText: {
    color: "#F59E0B",
    fontWeight: "500",
  },
  
  // Upload
  uploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  placeholderBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  placeholderText: { marginTop: 6, color: "#9CA3AF", fontSize: 12 },
  
  // Buttons
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
  
  // Discount preview
  discountPreview: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  discountPreviewText: {
    color: "#92400e",
    fontWeight: "500",
    textAlign: "center",
  },
});