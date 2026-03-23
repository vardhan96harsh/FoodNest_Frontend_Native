// app/roles/superadmin/batteries-management.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/env";

/* ===================== Types ===================== */

type Battery = {
  _id: string;
  imei: string;
  vehicle: string | null;
  type:
    | "Lithium-ion 48V"
    | "Lithium-ion 60V"
    | "Lead Acid 48V"
    | "Lead Acid 60V";
  capacity: string;
  installationDate: string;
  status: "Active" | "Maintenance" | "Faulty";
  lastChecked?: string;
};

/* ===================== Helpers ===================== */

async function getStoredToken(): Promise<string | null> {
  const possibleKeys = ["authToken", "token", "user", "userToken"];

  for (const key of possibleKeys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        if (parsed?.token) return parsed.token;
      } catch {
        return value;
      }
    } catch {}
  }
  return null;
}

async function authFetch(path: string, options: any = {}) {
  const token = await getStoredToken();

  const headers: any = {
    ...(options.headers || {}),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

function SolidButton({ onPress, children }: any) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 10, overflow: "hidden" }}>
      <LinearGradient
        colors={["#fde047", "#facc15"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btnSolid}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {children}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function Segmented({ options, value, onChange }: any) {
  return (
    <View style={styles.segmented}>
      {options.map((opt: string) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ===================== MAIN SCREEN ===================== */

export default function BatteriesManagement() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(false);

  // Add battery modal
  const [openAdd, setOpenAdd] = useState(false);
  const [imei, setIMEI] = useState("");
  const [type, setType] = useState<Battery["type"] | "">("");
  const [capacity, setCapacity] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [status, setStatus] = useState<Battery["status"] | "">("Active");

  // Edit modal
  const [editingBattery, setEditingBattery] = useState<Battery | null>(null);
  const [openEdit, setOpenEdit] = useState(false);

  // Delete modal
  const [openDelete, setOpenDelete] = useState(false);
  const [activeBattery, setActiveBattery] = useState<Battery | null>(null);

  const loadBatteries = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/batteries");
      if (!res.ok) throw new Error("Failed to load batteries");

      const data = await res.json();
      setBatteries(data);
    } catch (e) {
      Alert.alert("Error", "Failed to load batteries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatteries();
  }, []);

  /* ========== CREATE BATTERY ========== */

  const createBattery = async () => {
    if (!imei || !type || !status) return;

    const payload = {
      imei,
      type,
      capacity,
      installationDate: installDate || today(),
      status,
    };

    try {
      const res = await authFetch("/api/batteries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");

      const saved = await res.json();
      setBatteries((prev) => [...prev, saved]);

      setOpenAdd(false);
      setIMEI("");
      setType("");
      setCapacity("");
      setInstallDate("");
      setStatus("Active");
    } catch (e) {
      Alert.alert("Error", "Could not add battery.");
    }
  };

  /* ========== UPDATE BATTERY ========== */

  const updateBattery = async () => {
    if (!editingBattery) return;

    try {
      const res = await authFetch(`/api/batteries/${editingBattery._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingBattery),
      });

      if (!res.ok) throw new Error("Failed");

      const updated = await res.json();
      setBatteries((prev) =>
        prev.map((b) => (b._id === updated._id ? updated : b))
      );

      setOpenEdit(false);
      setEditingBattery(null);
    } catch (e) {
      Alert.alert("Error", "Failed to update battery.");
    }
  };

  /* ========== DELETE BATTERY ========== */

  const deleteBattery = async () => {
    if (!activeBattery) return;

    try {
      const res = await authFetch(`/api/batteries/${activeBattery._id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed");

      setBatteries((prev) =>
        prev.filter((b) => b._id !== activeBattery._id)
      );

      setOpenDelete(false);
      setActiveBattery(null);
    } catch (e) {
      Alert.alert("Error", "Failed to delete battery.");
    }
  };

  /* ===================== RENDER ===================== */

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.h1}>Batteries Management</Text>
      <Text style={styles.subtle}>Manage all batteries</Text>

      <View style={[styles.row, { marginTop: 16, gap: 8 }]}>
        <SolidButton onPress={() => setOpenAdd(true)}>
          <Feather name="battery-charging" size={16} color="#fff" />
          <Text style={[styles.btnSolidText, { marginLeft: 6 }]}>Add Battery</Text>
        </SolidButton>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 16 }} />
      ) : (
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={[styles.tableCell, styles.header, { flex: 2 }]}>IMEI</Text>
            <Text style={[styles.tableCell, styles.header, { flex: 2 }]}>
              Vehicle
            </Text>
            <Text style={[styles.tableCell, styles.header, { flex: 2 }]}>Type</Text>
            <Text style={[styles.tableCell, styles.header, { flex: 1 }]}>
              Status
            </Text>
          </View>

          {/* Rows */}
          {batteries.map((b) => (
            <View key={b._id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{b.imei}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {b.vehicle || "Unassigned"}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{b.type}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{b.status}</Text>

              {/* EDIT */}
              <Pressable
                onPress={() => {
                  setEditingBattery({ ...b });
                  setOpenEdit(true);
                }}
                style={{ paddingHorizontal: 6 }}
              >
                <Feather name="edit-3" size={16} color="#2563eb" />
              </Pressable>

              {/* DELETE */}
              <Pressable
                onPress={() => {
                  setActiveBattery(b);
                  setOpenDelete(true);
                }}
                style={{ paddingHorizontal: 6 }}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ================= Add Modal ================= */}
      <Modal transparent visible={openAdd} animationType="slide">
        <View style={styles.backdrop}>
          <View style={[styles.card, { padding: 16, gap: 12 }]}>
            <Text style={styles.modalTitle}>Add New Battery</Text>

            <TextInput
              style={styles.input}
              value={imei}
              onChangeText={setIMEI}
              placeholder="IMEI Number"
            />

            <Segmented
              options={[
                "Lithium-ion 48V",
                "Lithium-ion 60V",
                "Lead Acid 48V",
                "Lead Acid 60V",
              ]}
              value={type}
              onChange={setType}
            />

            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              placeholder="Capacity"
            />

            <TextInput
              style={styles.input}
              value={installDate}
              onChangeText={setInstallDate}
              placeholder="Installation Date (YYYY-MM-DD)"
            />

            <Segmented
              options={["Active", "Maintenance", "Faulty"]}
              value={status}
              onChange={setStatus}
            />

            <View style={[styles.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Pressable
                style={styles.btnOutline}
                onPress={() => setOpenAdd(false)}
              >
                <Text>Cancel</Text>
              </Pressable>

              <SolidButton onPress={createBattery}>
                <Text style={styles.btnSolidText}>Add</Text>
              </SolidButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= Edit Modal ================= */}
      <Modal transparent visible={openEdit} animationType="slide">
        <View style={styles.backdrop}>
          <View style={[styles.card, { padding: 16, gap: 12 }]}>
            <Text style={styles.modalTitle}>Edit Battery</Text>

            {editingBattery && (
              <>
                <TextInput
                  style={styles.input}
                  value={editingBattery.imei}
                  onChangeText={(txt) =>
                    setEditingBattery((p) => (p ? { ...p, imei: txt } : p))
                  }
                />

                <Segmented
                  options={[
                    "Lithium-ion 48V",
                    "Lithium-ion 60V",
                    "Lead Acid 48V",
                    "Lead Acid 60V",
                  ]}
                  value={editingBattery.type}
                  onChange={(v) =>
                    setEditingBattery((p) => (p ? { ...p, type: v } : p))
                  }
                />

                <TextInput
                  style={styles.input}
                  value={editingBattery.capacity}
                  onChangeText={(txt) =>
                    setEditingBattery((p) => (p ? { ...p, capacity: txt } : p))
                  }
                />

                <TextInput
                  style={styles.input}
                  value={editingBattery.installationDate}
                  onChangeText={(txt) =>
                    setEditingBattery((p) =>
                      p ? { ...p, installationDate: txt } : p
                    )
                  }
                />

                <Segmented
                  options={["Active", "Maintenance", "Faulty"]}
                  value={editingBattery.status}
                  onChange={(v) =>
                    setEditingBattery((p) => (p ? { ...p, status: v } : p))
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Vehicle ID (optional)"
                  value={editingBattery.vehicle || ""}
                  onChangeText={(txt) =>
                    setEditingBattery((p) =>
                      p ? { ...p, vehicle: txt === "" ? null : txt } : p
                    )
                  }
                />
              </>
            )}

            <View style={[styles.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Pressable
                style={styles.btnOutline}
                onPress={() => setOpenEdit(false)}
              >
                <Text>Cancel</Text>
              </Pressable>

              <SolidButton onPress={updateBattery}>
                <Text style={styles.btnSolidText}>Update</Text>
              </SolidButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= Delete Modal ================= */}
      <Modal transparent visible={openDelete} animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.card, { padding: 16, gap: 12 }]}>
            <Text style={styles.removeTitle}>Delete Battery</Text>
            <Text style={styles.subtle}>
              Remove battery {activeBattery?.imei}?
            </Text>

            <View style={[styles.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Pressable
                style={styles.btnOutline}
                onPress={() => setOpenDelete(false)}
              >
                <Text>Cancel</Text>
              </Pressable>

              <Pressable style={styles.btnDanger} onPress={deleteBattery}>
                <Text style={styles.btnSolidText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 60 },
  h1: { fontSize: 22, fontWeight: "800", color: "#111" },
  subtle: { fontSize: 13, color: "#6b7280" },

  row: { flexDirection: "row", alignItems: "center" },

  btnSolid: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSolidText: { fontWeight: "700", color: "#111" },

  btnOutline: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnDanger: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  tableHeaderRow: {
    backgroundColor: "#f3f4f6",
  },
  tableCell: { fontSize: 12, color: "#111" },
  header: { fontWeight: "700" },

  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#111827" },
  segmentText: { color: "#111", fontWeight: "700" },
  segmentTextActive: { color: "#fff" },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  removeTitle: { fontSize: 18, fontWeight: "800", color: "#ef4444" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
});
