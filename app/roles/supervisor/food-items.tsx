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

// ---- Local fallback images (REMOVED - no longer using) ----
// const Chai = require("../../../assets/chai.png");
// const VadaPav = require("../../../assets/vadapav.png");
// const Poha = require("../../../assets/poha.png");
// const Water = require("../../../assets/water.png");

const UNIT_OPTIONS = ["ml", "L", "g", "kg", "piece", "packet"];

// ====== API CONFIG (adjust to your env) ======
import { API_BASE_URL as API_URL } from "@/constants/env";

// ---- Types ----
type Item = {
  _id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  tax?: number;
  imageUrl?: string | null;
  rawMaterials?: Array<{ name: string; qty?: number; unit?: string }>;
};

const toINR = (thb: number) => Math.round(thb * 2.5);

export default function FoodItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  // form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [category, setCategory] = useState("");
  const [tax, setTax] = useState<string>("");
  const [available, setAvailable] = useState(true);
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
    setCategory("");
    setTax("");
    setAvailable(true);
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
    setCategory(it.category);
    setTax(it.tax ? String(it.tax) : "");
    setAvailable(it.available);
    setPicked(null);

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

  // ===== API helpers =====
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

  // ===== Load items from backend =====
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Item[]>("/api/foods");
      console.log("FOODS RECEIVED:", data);
      setItems(data);
    } catch (e: any) {
      console.warn("/api/foods failed:", e?.message || e);
      setItems([]);
      setError(e?.message || "Failed to load food items from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const save = async () => {
    const p = Number(price);
    const t = tax ? Number(tax) : undefined;
    if (!name.trim() || !category.trim() || Number.isNaN(p)) {
      Alert.alert("Please fill valid Name, Category and Price.");
      return;
    }

    const cleanRawMaterials = rawMaterials
      .map((r) => ({
        name: r.name.trim(),
        qty: r.qty.trim(),
        unit: r.unit.trim(),
      }))
      .filter((r) => r.name.length > 0)
      .map((r) => ({
        name: r.name,
        qty: r.qty === "" ? undefined : Number(r.qty),
        unit: r.unit || undefined,
      }));

    setSaving(true);
    try {
      if (editing) {
        let updated: Item;
        if (picked) {
          const fd = new FormData();
          fd.append("name", name);
          fd.append("price", String(p));
          fd.append("category", category);
          if (t !== undefined) fd.append("tax", String(t));
          fd.append("available", String(available));
          fd.append("rawMaterials", JSON.stringify(cleanRawMaterials));
          await appendPickedImage(fd, picked);
          updated = await apiSend<Item>(
            `/api/foods/${editing._id}`,
            "PATCH",
            fd,
            true
          );
        } else {
          updated = await apiSend<Item>(`/api/foods/${editing._id}`, "PATCH", {
            name,
            price: p,
            category,
            tax: t,
            available,
            rawMaterials: cleanRawMaterials,
          });
        }
        setItems((arr) =>
          arr.map((x) => (x._id === editing._id ? updated : x))
        );
      } else {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("price", String(p));
        fd.append("category", category);
        if (t !== undefined) fd.append("tax", String(t));
        fd.append("available", String(available));
        fd.append("rawMaterials", JSON.stringify(cleanRawMaterials));
        if (picked) {
          await appendPickedImage(fd, picked);
        }
        const created = await apiSend<Item>("/api/foods", "POST", fd, true);
        setItems((arr) => [created, ...arr]);
      }
      setIsAdding(false);
      resetForm();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Unable to save item");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (_id: string) => {
    try {
      await apiSend(`/api/foods/${_id}`, "DELETE", {});
      setItems((arr) => arr.filter((x) => x._id !== _id));
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Unable to delete");
    }
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
              {/* Image (square thumb) */}
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

              {/* Middle content */}
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDesc}>{item.category}</Text>
                  </View>
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
                  <Text style={styles.price}>
                    ฿{item.price}
                    <Text style={styles.inr}>
                      {" "}
                      INR {Math.round(item.price * 2.5)}
                    </Text>
                  </Text>

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
                  <Text style={styles.label}>Food Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter food name"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Price (฿)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Snacks, Beverages"
                    value={category}
                    onChangeText={setCategory}
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

              <View style={[styles.formRow, { alignItems: "center" }]}>
                <View
                  style={[
                    styles.field,
                    { flexDirection: "row", alignItems: "center", gap: 10 },
                  ]}
                >
                  <RNSwitch value={available} onValueChange={setAvailable} />
                  <Text style={styles.label}>Available</Text>
                </View>
              </View>

              {/* Raw Materials */}
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={styles.label}>Raw Materials</Text>

                {rawMaterials.map((rm, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Name</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Poha / Oil / Peanuts"
                        value={rm.name}
                        onChangeText={(v) => updateRawMaterial(idx, "name", v)}
                      />
                    </View>

                    <View style={{ width: 80 }}>
                      <Text style={styles.label}>Qty</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        value={rm.qty}
                        onChangeText={(v) => updateRawMaterial(idx, "qty", v)}
                      />
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                        position: "relative",
                        zIndex: openUnitIndex === idx ? 100 : 1,
                      }}
                    >
                      <View
                        style={{ width: 90, position: "relative", zIndex: 200 }}
                      >
                        <Text style={styles.label}>Unit</Text>

                        <Pressable
                          onPress={() =>
                            setOpenUnitIndex(openUnitIndex === idx ? null : idx)
                          }
                          style={styles.unitBox}
                        >
                          <Text
                            style={{
                              color: rm.unit ? "#111827" : "#9ca3af",
                              fontSize: 14,
                            }}
                          >
                            {rm.unit || "Select"}
                          </Text>

                          <Feather
                            name={
                              openUnitIndex === idx
                                ? "chevron-up"
                                : "chevron-down"
                            }
                            size={16}
                            color="#6b7280"
                          />
                        </Pressable>

                        {openUnitIndex === idx && (
                          <View
                            style={styles.unitDropdown}
                            pointerEvents="auto"
                          >
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
                    </View>

                    <Pressable
                      onPress={() => removeRawMaterialRow(idx)}
                      style={[styles.iconBtn, { marginTop: 22 }]}
                    >
                      <Feather name="minus" size={18} />
                    </Pressable>
                  </View>
                ))}

                <View style={{ flexDirection: "row", marginTop: 6 }}>
                  <Pressable onPress={addRawMaterialRow} style={styles.iconBtn}>
                    <Feather name="plus" size={18} />
                  </Pressable>
                  <Text
                    style={{
                      alignSelf: "center",
                      marginLeft: 8,
                      color: "#6b7280",
                    }}
                  >
                    Add another material
                  </Text>
                </View>
              </View>

              {/* Upload area */}
              <View style={{ gap: 10, marginTop: 8 ,width:"50%"}}>
                <Text style={styles.label}>Food Image</Text>
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
                  <ActivityIndicator />
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

  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  row: { flexDirection: "row", gap: 16 },
  card: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },

  imageBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    overflow: "hidden",
    aspectRatio: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDesc: { color: "#6b7280" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOn: { backgroundColor: "#10b98122", borderColor: "#10b98155" },
  badgeOff: { backgroundColor: "#e5e7eb", borderColor: "#d1d5db" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextOn: { color: "#065f46" },
  badgeTextOff: { color: "#374151" },

  cardFooter: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { fontSize: 20, fontWeight: "700", color: "#111827" },
  inr: { marginLeft: 4, color: "#6b7280", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#d1d5db",
  },

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
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalDesc: { color: "#6b7280" },

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

  placeholderBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  placeholderText: { marginTop: 6, color: "#9CA3AF", fontSize: 12 },

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

  cardFooterRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
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
    top: 70,
    left: 0,
    width: 120,
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#d1d5db",
    zIndex: 100,
    elevation: 12,
    pointerEvents: "auto",
  },

  unitOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  unitOptionText: {
    fontSize: 14,
    color: "#111827",
  },

  modalHeader: { marginBottom: 4 },
  modalScroll: {},
  modalContent: { gap: 12, paddingBottom: 8 },
});