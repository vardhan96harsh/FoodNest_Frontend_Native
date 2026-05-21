import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MapPicker from "@/components/MapPicker";
import { API_BASE_URL } from "@/constants/env";

/* ---------------- Types ---------------- */
type Stop = {
  name: string;
  lat: number;
  lng: number;
};

type RouteItem = {
  id: string;
  name: string;
  region: string;
  status: "Active" | "Inactive";
  rider?: string;
  stops: Stop[];
  duration?: string;
  lastUpdate?: string;
};

/* ---------------- Screen ---------------- */
export default function RoutesManagement() {
  const { t } = useTranslation();

  /* ---------- States ---------- */
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteItem | null>(null);

  const [routeName, setRouteName] = useState("");
  const [region, setRegion] = useState("");
  const [rider, setRider] = useState("");

  const [stops, setStops] = useState<Stop[]>([]);
  const [tab, setTab] = useState<"manual" | "map">("manual");

  const canSave =
    routeName.trim() &&
    region.trim() &&
    stops.length > 0;

  /* ---------------- Load routes from backend ---------------- */
  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/api/routes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!data.routes) return;

      const formatted: RouteItem[] = data.routes.map((r: any) => ({
        id: r._id,
        name: r.name,
        region: r.region,
        status: r.status,
        rider: r.rider?.name || "Unassigned",
        stops: r.stops || [],
        duration: "—",
        lastUpdate: "Just now",
      }));

      setRoutes(formatted);
    } catch (err) {
      console.log("Load routes error:", err);
    }
  };

  /* ---------------- Reset form ---------------- */
  const resetForm = () => {
    setEditing(null);
    setRouteName("");
    setRegion("");
    setRider("");
    setStops([]);
    setTab("manual");
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  const startEdit = (r: RouteItem) => {
    setEditing(r);
    setRouteName(r.name);
    setRegion(r.region);
    setRider(r.rider || "");
    setStops(r.stops);
    setOpen(true);
  };

  /* ---------------- Save route to backend ---------------- */
const save = async () => {
  if (!canSave) return;

  try {
    const token = await AsyncStorage.getItem("token");

    // Only send what backend expects
    const requestBody = {
      name: routeName.trim(),
      region: region.trim(),
      stops: stops.map((s, index) => ({
        name: s.name,
        lat: Number(s.lat) || null,
        lng: Number(s.lng) || null,
        order: index,
      })),
      description: "" // optional
    };

    const url = editing 
      ? `${API_BASE_URL}/api/routes/${editing.id}` 
      : `${API_BASE_URL}/api/routes`;
    
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      await loadRoutes();
      setOpen(false);
      resetForm();
    } else {
      console.log("Error saving route:", data);
      alert(data.error || "Failed to save route");
    }
  } catch (err) {
    console.log("Save route error:", err);
    alert("An error occurred");
  }
};

  /* ---------------- Delete Route ---------------- */
  const deleteRoute = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/api/routes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.ok) {
        setRoutes((prev) => prev.filter((r) => r.id !== id));
      } else {
        console.log("Delete failed:", data);
      }
    } catch (err) {
      console.log("Delete route error:", err);
    }
  };

  /* ---------------- Manual stops helpers ---------------- */
  const addStop = () =>
    setStops((prev) => [
      ...prev,
      { name: `Stop ${prev.length + 1}`, lat: 0, lng: 0 },
    ]);

  const removeStop = (i: number) =>
    setStops((prev) => prev.filter((_, idx) => idx !== i));

  const changeStopName = (i: number, v: string) =>
    setStops((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, name: v } : s))
    );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <LanguageSwitcher />

      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Routes Management</Text>
          <Text style={styles.subtle}>Manage routes, stops, and assignments.</Text>
        </View>

        <Pressable style={styles.btnSolid} onPress={startCreate}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.btnSolidText}> Add Route</Text>
        </Pressable>
      </View>

      {/* ROUTES LIST */}
      <View style={{ gap: 12 }}>
        {routes.map((route) => (
          <View key={route.id} style={styles.card}>
            <View style={[styles.rowBetween, { marginBottom: 8 }]}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "800" }}>
                  {route.name}
                </Text>

                <View style={[styles.row, { gap: 12, marginTop: 4 }]}>
                  {/* Rider */}
                  <View style={styles.inlineRow}>
                    <Feather name="user" size={12} color="#6b7280" />
                    <Text style={styles.subtleSmall}> {route.rider}</Text>
                  </View>

                  {/* Duration */}
                  <View style={styles.inlineRow}>
                    <Feather name="clock" size={12} color="#6b7280" />
                    <Text style={styles.subtleSmall}> {route.duration}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.row, { gap: 12 }]}>
                <Pressable style={styles.btnOutlineSm} onPress={() => startEdit(route)}>
                  <Text>Edit</Text>
                </Pressable>

                <Pressable onPress={() => deleteRoute(route.id)}>
                  <Feather name="trash-2" size={20} color="#dc2626" />
                </Pressable>
              </View>
            </View>

            {/* Stops */}
            <View>
              <View style={[styles.inlineRow, { gap: 6 }]}>
                <Feather name="map-pin" size={14} />
                <Text style={{ fontWeight: "700" }}>Stops</Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {route.stops.map((stop, idx) => (
                  <View key={idx} style={styles.stopPill}>
                    <View style={styles.stopIndex}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text>{stop.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Modal */}
      <Modal
        transparent
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { padding: 16, gap: 12, maxHeight: "90%", width: "100%" }]}>
            <View>
              <View style={[styles.inlineRow, { gap: 8 }]}>
                <Feather name="map" size={18} />
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  {editing ? "Edit Route" : "Create Route"}
                </Text>
              </View>
              <Text style={styles.subtle}>Add route details and stops.</Text>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              {/* Fields */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Route Name</Text>
                  <TextInput
                    style={styles.input}
                    value={routeName}
                    onChangeText={setRouteName}
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Region</Text>
                  <TextInput
                    style={styles.input}
                    value={region}
                    onChangeText={setRegion}
                  />
                </View>
              </View>

              {/* Tabs */}
              <View style={styles.tabsBar}>
                <Pressable
                  onPress={() => setTab("manual")}
                  style={[styles.tabBtn, tab === "manual" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, tab === "manual" && styles.tabTextActive]}>
                    Manual Entry
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setTab("map")}
                  style={[styles.tabBtn, tab === "map" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, tab === "map" && styles.tabTextActive]}>
                    Map
                  </Text>
                </Pressable>
              </View>

              {/* MANUAL MODE */}
              {tab === "manual" ? (
                <View style={{ gap: 10 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Stops</Text>
                    <Pressable style={styles.btnOutlineSm} onPress={addStop}>
                      <Feather name="plus" size={14} />
                      <Text>Add</Text>
                    </Pressable>
                  </View>

                  {stops.map((s, idx) => (
                    <View key={idx} style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={s.name}
                        onChangeText={(v) => changeStopName(idx, v)}
                        placeholder={`Stop ${idx + 1}`}
                      />

                      <Pressable style={styles.btnOutlineSm} onPress={() => removeStop(idx)}>
                        <Feather name="x" size={14} />
                        <Text>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                /* MAP MODE */
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Tap on map to add stops</Text>
                  <MapPicker stops={stops} setStops={setStops} />
                </View>
              )}

              {/* ACTION BUTTONS */}
              <View style={[styles.row, { justifyContent: "flex-end", gap: 8 }]}>
                <Pressable style={styles.btnOutline} onPress={() => { setOpen(false); resetForm(); }}>
                  <Text>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.btnSolid, !canSave && { opacity: 0.5 }]}
                  disabled={!canSave}
                  onPress={save}
                >
                  <Text style={styles.btnSolidText}>
                    {editing ? "Save Route" : "Create Route"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280" },
  subtleSmall: { color: "#6b7280", fontSize: 12 },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inlineRow: { flexDirection: "row", alignItems: "center" },
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
  stopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  stopIndex: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 6 },
  label: { fontWeight: "700", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnSolid: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSolidText: { color: "#fff", fontWeight: "700" },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnOutlineSm: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabsBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tabBtnActive: { backgroundColor: "#111827" },
  tabText: { fontWeight: "700", color: "#111827" },
  tabTextActive: { color: "#fff" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
});
