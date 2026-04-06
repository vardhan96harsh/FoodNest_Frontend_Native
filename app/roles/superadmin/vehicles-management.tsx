// app/roles/superadmin/vehicles-management.tsx

import React, { useMemo, useState, useEffect } from "react";
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/env";

const { width: screenWidth } = Dimensions.get("window");

/* ===================== Types ===================== */

type VehicleStatus = "Available" | "In Use" | "Issue";

type Vehicle = {
  _id?: string;
  id: number | string;
  registrationNo: string;
  serviceDate: string; // YYYY-MM-DD
  status: VehicleStatus;
  assignedRider: string | null;
  notes: string;
};

type ServiceRecord = {
  id: number;
  vehicleId: string | number;
  date: string;
  type: "Regular Maintenance" | "Repair";
  description: string;
  cost: number;
  mechanic: string;
};

type Rider = { id: number; name: string; available: boolean };

/* ===================== Static (riders) ===================== */

const riders: Rider[] = [
  { id: 1, name: "John Smith", available: false },
  { id: 2, name: "Mike Davis", available: true },
  { id: 3, name: "Sarah Johnson", available: true },
];

/* ===================== Helpers ===================== */

function tone(status: VehicleStatus) {
  switch (status) {
    case "Available":
      return { bg: "#10b98122", border: "#10b98155", text: "#065f46" };
    case "In Use":
      return { bg: "#2563eb22", border: "#2563eb55", text: "#1e40af" };
    case "Issue":
      return { bg: "#ef444422", border: "#ef444455", text: "#991b1b" };
  }
}

const field = (label: string, children: React.ReactNode) => (
  <View style={{ gap: 6 }}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const today = () => new Date().toISOString().slice(0, 10);

// 🔁 map backend vehicle → local type (SAFE for missing / null dates)
function mapVehicleFromApi(doc: any): Vehicle {
  let serviceDate = today();
  if (typeof doc.serviceDate === "string" && doc.serviceDate.length >= 10) {
    serviceDate = doc.serviceDate.slice(0, 10);
  }

  return {
    id: doc._id?.toString() || String(Date.now()),
    registrationNo: doc.registrationNo || "",
    serviceDate,
    status: (doc.status as VehicleStatus) || "Available",
    assignedRider: doc.assignedRider ?? null,
    notes: doc.notes || "",
  };
}

// 🔐 1) TRY ALL POSSIBLE TOKEN KEYS
async function getStoredToken(): Promise<string | null> {
  const possibleKeys = [
    "authToken",
    "token",
    "accessToken",
    "userToken",
    "user",
    "userData",
  ];

  for (const key of possibleKeys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) continue;

      // If JSON stored ({"token": "...", ...})
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && parsed.token) {
          console.log(`authFetch: using token from key "${key}" (JSON.token)`);
          return parsed.token as string;
        }
      } catch {
        // Not JSON, treat as plain token string
        console.log(`authFetch: using token from key "${key}" (string)`);
        return value;
      }
    } catch (err) {
      console.log("Error reading token key", key, err);
    }
  }

  console.log("authFetch: NO token found in AsyncStorage");
  return null;
}

// 🔐 2) FETCH WITH AUTH HEADER
async function authFetch(path: string, options: any = {}) {
  const token = await getStoredToken();

  const headers: any = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

/* ===== Reusable: Gradient primary button ===== */
function SolidButton({
  onPress,
  disabled,
  children,
  style,
}: {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { borderRadius: 10, overflow: "hidden", opacity: pressed ? 0.9 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={["#fde047", "#facc15"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btnSolid, disabled && { opacity: 0.5 }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {children}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/* ===================== Screen ===================== */

export default function VehiclesManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // Add Vehicle modal
  const [openAdd, setOpenAdd] = useState(false);
  const [regNo, setRegNo] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [initialStatus, setInitialStatus] =
    useState<VehicleStatus>("Available");
  const [notes, setNotes] = useState("");

  // Issue modal
  const [openIssue, setOpenIssue] = useState(false);
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [issueType, setIssueType] = useState("");
  const [issueDesc, setIssueDesc] = useState("");

  // Service & Remove modals
  const [openService, setOpenService] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);

  // Edit Vehicle modal
  const [openEditVehicle, setOpenEditVehicle] = useState(false);
  const [editVehicleData, setEditVehicleData] = useState<Vehicle | null>(null);

  const availableRiders = useMemo(() => riders.filter((r) => r.available), []);

  /* ===================== Load vehicles (backend) ===================== */

  const loadVehiclesFromServer = async () => {
    setLoadingVehicles(true);
    try {
      const res = await authFetch("/api/vehicles");

      if (res.status === 401) {
        console.log("GET /api/vehicles 401 (Missing Bearer token)");
        Alert.alert(
          "Not authorised",
          "No login token found. Please login again as SuperAdmin."
        );
        setVehicles([]);
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        console.log("GET /api/vehicles failed:", txt);
        Alert.alert("Error", "Failed to load vehicles from server.");
        setVehicles([]);
        return;
      }

      const data = await res.json();
      const mapped: Vehicle[] = Array.isArray(data)
        ? data.map(mapVehicleFromApi)
        : [];

      setVehicles(mapped);
    } catch (err) {
      console.log("Error loading vehicles:", err);
      Alert.alert("Error", "Could not connect to server.");
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  useEffect(() => {
    loadVehiclesFromServer();
  }, []);

  /* ===================== Actions ===================== */

  const addVehicle = async () => {
    if (!regNo.trim()) return;

    const payload = {
      name: regNo.trim(),
      type: "Bike",
      registrationNo: regNo.trim(),
      serviceDate: serviceDate || today(),
      status: initialStatus,
      assignedRider: null,
      notes: notes.trim(),
    };

    try {
      const res = await authFetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const txt = await res.text();
        console.log("Create vehicle 401:", txt);
        Alert.alert(
          "Not authorised",
          "Backend says: Missing or invalid token.\nPlease login again as SuperAdmin."
        );
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        console.log("Create vehicle failed:", txt);
        Alert.alert("Error", "Failed to create vehicle.");
        return;
      }

      const created = await res.json();
      const v = mapVehicleFromApi(created);

      setVehicles((prev) => [v, ...prev]);

      setOpenAdd(false);
      setRegNo("");
      setServiceDate("");
      setInitialStatus("Available");
      setNotes("");
    } catch (err) {
      console.log("Error calling POST /api/vehicles:", err);
      Alert.alert("Error", "Could not connect to server");
    }
  };

  const markIssue = (v: Vehicle) => {
    setActiveVehicle(v);
    setOpenIssue(true);
  };

  const submitIssue = () => {
    if (!activeVehicle || !issueType) return;
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === activeVehicle.id
          ? {
              ...v,
              status: "Issue",
              notes: [v.notes, `${issueType}: ${issueDesc}`]
                .filter(Boolean)
                .join(" · "),
            }
          : v
      )
    );
    setOpenIssue(false);
    setActiveVehicle(null);
    setIssueType("");
    setIssueDesc("");
  };

  const clearIssue = (vehId: Vehicle["id"]) =>
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehId ? { ...v, status: "Available" } : v))
    );

  const assignRider = (vehId: Vehicle["id"], name: string | null) =>
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehId
          ? { ...v, assignedRider: name, status: name ? "In Use" : "Available" }
          : v
      )
    );

  const openServiceFor = (v: Vehicle) => {
    setActiveVehicle(v);
    setOpenService(true);
  };

  const openRemoveFor = (v: Vehicle) => {
    setActiveVehicle(v);
    setOpenRemove(true);
  };

  const confirmRemove = async () => {
    if (!activeVehicle) return;
    const id = activeVehicle.id;

    try {
      const res = await authFetch(`/api/vehicles/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log("Delete vehicle failed:", txt);
        Alert.alert("Error", "Failed to remove vehicle from server.");
        return;
      }

      setVehicles((prev) => prev.filter((v) => v.id !== id));
      setServiceRecords((prev) => prev.filter((s) => s.vehicleId !== id));
      setOpenRemove(false);
      setActiveVehicle(null);
    } catch (err) {
      console.log("Error deleting vehicle:", err);
      Alert.alert("Error", "Could not connect to server to remove vehicle.");
    }
  };

  const handleUpdateVehicle = async () => {
    if (!editVehicleData) return;

    try {
      const res = await authFetch(`/api/vehicles/${editVehicleData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editVehicleData),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log("Update vehicle failed:", txt);
        Alert.alert("Error", "Failed to update vehicle.");
        return;
      }

      const updated = await res.json();
      const mapped = mapVehicleFromApi(updated);

      setVehicles((prev) => prev.map((v) => (v.id === mapped.id ? mapped : v)));

      setOpenEditVehicle(false);
      setEditVehicleData(null);
    } catch (err) {
      console.log("Error updating vehicle:", err);
      Alert.alert("Error", "Could not connect to server.");
    }
  };

  /* ===================== Render ===================== */

  const renderVehicles = () => (
    <View style={{ gap: 12 }}>
      {vehicles.map((v) => {
        const t = tone(v.status);
        return (
          <View key={v.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { gap: 8, alignItems: "center", marginBottom: 4 }]}>
                  <Feather name="truck" size={18} />
                  <Text style={styles.cardTitle}>{v.registrationNo}</Text>
                </View>
                <Text style={styles.subtleSmall}>
                  Last service: {v.serviceDate}
                </Text>
              </View>
              <View style={{ marginLeft: 8 }}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: t.bg, borderColor: t.border },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: t.text }]}>
                    {v.status}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 10, gap: 6 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.subtleSmall}>
                  Rider: {v.assignedRider ?? "Unassigned"}
                </Text>
                {v.assignedRider ? (
                  <Pressable
                    style={styles.btnOutlineSm}
                    onPress={() => assignRider(v.id, null)}
                  >
                    <Feather name="user-x" size={14} />
                    <Text style={{ marginLeft: 4 }}> Unassign</Text>
                  </Pressable>
                ) : (
                  <AssignMenu
                    riders={availableRiders}
                    onPick={(name) => assignRider(v.id, name)}
                  />
                )}
              </View>

              {!!v.notes && (
                <Text style={styles.subtleSmall}>Notes: {v.notes}</Text>
              )}
            </View>

            {/* Action Buttons - Wrapped for better mobile layout */}
            <View style={styles.actionButtonsContainer}>
              {v.status === "Issue" ? (
                <Pressable
                  style={[styles.btnOutlineSm, styles.actionButton]}
                  onPress={() => clearIssue(v.id)}
                >
                  <Feather name="check-circle" size={14} />
                  <Text style={{ marginLeft: 4 }}> Resolve</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.btnOutlineSm, styles.actionButton]}
                  onPress={() => markIssue(v)}
                >
                  <Feather name="alert-triangle" size={14} />
                  <Text style={{ marginLeft: 4 }}> Report Issue</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.btnOutlineSm, styles.actionButton]}
                onPress={() => openServiceFor(v)}
              >
                <Feather name="clock" size={14} />
                <Text style={{ marginLeft: 4 }}> Service</Text>
              </Pressable>

              <Pressable
                style={[styles.btnOutlineSm, styles.actionButton]}
                onPress={() => {
                  setEditVehicleData(v);
                  setOpenEditVehicle(true);
                }}
              >
                <Feather name="edit-3" size={14} color="#2563eb" />
                <Text style={{ marginLeft: 4, color: "#2563eb" }}> Edit</Text>
              </Pressable>

              <Pressable
                style={[styles.btnOutlineSm, styles.actionButton, { borderColor: "#ef4444" }]}
                onPress={() => openRemoveFor(v)}
              >
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={{ marginLeft: 4, color: "#ef4444" }}> Remove</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {!loadingVehicles && vehicles.length === 0 && (
        <Text
          style={[styles.subtleSmall, { textAlign: "center", marginTop: 16 }]}
        >
          No vehicles found. Use "Add Vehicle" to create one.
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Vehicles Management</Text>
          <Text style={styles.subtle}>
            Manage fleet vehicles and track their status
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.row, { gap: 8, marginTop: 8 }]}>
        <SolidButton onPress={() => setOpenAdd(true)}>
          <Feather name="plus" size={16} color="#ffffff" />
          <Text
            style={[styles.btnSolidText, { color: "#ffffff", marginLeft: 6 }]}
          >
            Add Vehicle
          </Text>
        </SolidButton>
      </View>

      {/* Loading state */}
      {loadingVehicles && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {/* Vehicles list */}
      {renderVehicles()}

      {/* ========== Add Vehicle Modal ========== */}
      <Modal
        transparent
        visible={openAdd}
        animationType="slide"
        onRequestClose={() => setOpenAdd(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.card, { padding: 16, gap: 12 }]}>
                <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                  <Feather name="truck" size={18} />
                  <Text style={{ fontSize: 18, fontWeight: "800" }}>
                    Add New Vehicle
                  </Text>
                </View>

                {field(
                  "Registration Number *",
                  <TextInput
                    value={regNo}
                    onChangeText={setRegNo}
                    placeholder="e.g., MH12AB1234"
                    style={styles.input}
                  />
                )}

                <View style={styles.rowWithGap}>
                  <View style={styles.flex1}>
                    {field(
                      "Last Service Date",
                      <TextInput
                        value={serviceDate}
                        onChangeText={setServiceDate}
                        placeholder="YYYY-MM-DD"
                        style={styles.input}
                      />
                    )}
                  </View>
                  <View style={styles.flex1}>
                    {field(
                      "Initial Status",
                      <Segmented
                        options={["Available", "Issue"]}
                        value={initialStatus}
                        onChange={(v) => setInitialStatus(v as VehicleStatus)}
                      />
                    )}
                  </View>
                </View>

                {field(
                  "Notes",
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any additional notes"
                    multiline
                    numberOfLines={3}
                    style={[styles.input, styles.textArea]}
                  />
                )}

                <View style={[styles.row, { justifyContent: "flex-end", gap: 8, marginTop: 8 }]}>
                  <Pressable
                    style={styles.btnOutline}
                    onPress={() => setOpenAdd(false)}
                  >
                    <Text>Cancel</Text>
                  </Pressable>
                  <SolidButton onPress={addVehicle} disabled={!regNo.trim()}>
                    <Text style={[styles.btnSolidText, { color: "#111" }]}>
                      Add Vehicle
                    </Text>
                  </SolidButton>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========== Report Issue Modal ========== */}
      <Modal
        transparent
        visible={openIssue}
        animationType="slide"
        onRequestClose={() => setOpenIssue(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.card, { padding: 16, gap: 12 }]}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800" }}>
                    Report Vehicle Issue
                  </Text>
                  <Text style={styles.subtleSmall}>
                    Vehicle: {activeVehicle?.registrationNo ?? "-"}
                  </Text>
                </View>

                {field(
                  "Issue Type",
                  <Segmented
                    options={[
                      "Puncture",
                      "Maintenance",
                      "Breakdown",
                      "Accident",
                      "Other",
                    ]}
                    value={issueType}
                    onChange={setIssueType}
                  />
                )}

                {field(
                  "Description",
                  <TextInput
                    value={issueDesc}
                    onChangeText={setIssueDesc}
                    placeholder="Describe the issue in detail"
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea]}
                  />
                )}

                <View style={[styles.row, { justifyContent: "flex-end", gap: 8, marginTop: 8 }]}>
                  <Pressable
                    style={styles.btnOutline}
                    onPress={() => setOpenIssue(false)}
                  >
                    <Text>Cancel</Text>
                  </Pressable>
                  <SolidButton onPress={submitIssue} disabled={!issueType}>
                    <Text style={[styles.btnSolidText, { color: "#111" }]}>
                      Report Issue
                    </Text>
                  </SolidButton>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========== Service Records Modal ========== */}
      <Modal
        transparent
        visible={openService}
        animationType="slide"
        onRequestClose={() => setOpenService(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            <View style={[styles.card, { padding: 16, gap: 12 }]}>
              <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                <Feather name="clock" size={18} />
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                  Service Records
                </Text>
              </View>
              <Text style={styles.subtleSmall}>
                Vehicle: {activeVehicle?.registrationNo ?? "-"}
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                <View style={{ gap: 8 }}>
                  {activeVehicle &&
                  serviceRecords.filter((s) => s.vehicleId === activeVehicle.id)
                    .length > 0 ? (
                    serviceRecords
                      .filter((s) => s.vehicleId === activeVehicle.id)
                      .map((rec) => (
                        <View key={rec.id} style={styles.serviceRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.serviceTitle}>
                              {rec.date} • {rec.type}
                            </Text>
                            <Text style={styles.subtleSmall}>
                              {rec.description}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.serviceCost}>
                              ₹{rec.cost.toLocaleString()}
                            </Text>
                            <Text style={styles.subtleSmall}>{rec.mechanic}</Text>
                          </View>
                        </View>
                      ))
                  ) : (
                    <Text
                      style={[
                        styles.subtleSmall,
                        { textAlign: "center", paddingVertical: 20 },
                      ]}
                    >
                      No service records found for this vehicle
                    </Text>
                  )}
                </View>
              </ScrollView>

              <View style={[styles.row, { justifyContent: "flex-end", marginTop: 8 }]}>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() => setOpenService(false)}
                >
                  <Text>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========== Remove Vehicle Modal ========== */}
      <Modal
        transparent
        visible={openRemove}
        animationType="fade"
        onRequestClose={() => setOpenRemove(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            <View style={[styles.card, { padding: 16, gap: 12 }]}>
              <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                <Feather name="trash-2" size={18} color="#ef4444" />
                <Text
                  style={{ fontSize: 18, fontWeight: "800", color: "#ef4444" }}
                >
                  Remove Vehicle
                </Text>
              </View>
              <Text style={styles.subtleSmall}>
                Are you sure you want to remove vehicle{" "}
                {activeVehicle?.registrationNo}? This action cannot be undone.
              </Text>

              <View style={[styles.row, { justifyContent: "flex-end", gap: 8, marginTop: 8 }]}>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() => setOpenRemove(false)}
                >
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnDanger} onPress={confirmRemove}>
                  <Text style={[styles.btnSolidText, { color: "#fff" }]}>Remove Vehicle</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========== Edit Vehicle Modal ========== */}
      <Modal
        transparent
        visible={openEditVehicle}
        animationType="slide"
        onRequestClose={() => setOpenEditVehicle(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.card, { padding: 16, gap: 12 }]}>
                <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                  <Feather name="truck" size={18} />
                  <Text style={{ fontSize: 18, fontWeight: "800" }}>
                    Edit Vehicle
                  </Text>
                </View>

                {field(
                  "Registration Number *",
                  <TextInput
                    value={editVehicleData?.registrationNo || ""}
                    onChangeText={(txt) =>
                      setEditVehicleData((prev) =>
                        prev ? { ...prev, registrationNo: txt } : prev
                      )
                    }
                    placeholder="e.g., MH12AB1234"
                    style={styles.input}
                  />
                )}

                <View style={styles.rowWithGap}>
                  <View style={styles.flex1}>
                    {field(
                      "Last Service Date",
                      <TextInput
                        value={editVehicleData?.serviceDate || ""}
                        onChangeText={(txt) =>
                          setEditVehicleData((prev) =>
                            prev ? { ...prev, serviceDate: txt } : prev
                          )
                        }
                        placeholder="YYYY-MM-DD"
                        style={styles.input}
                      />
                    )}
                  </View>

                  <View style={styles.flex1}>
                    {field(
                      "Status",
                      <Segmented
                        options={["Available", "Issue", "In Use"]}
                        value={editVehicleData?.status || ""}
                        onChange={(v) =>
                          setEditVehicleData((prev) =>
                            prev ? { ...prev, status: v as VehicleStatus } : prev
                          )
                        }
                      />
                    )}
                  </View>
                </View>

                {field(
                  "Notes",
                  <TextInput
                    value={editVehicleData?.notes || ""}
                    onChangeText={(txt) =>
                      setEditVehicleData((prev) =>
                        prev ? { ...prev, notes: txt } : prev
                      )
                    }
                    placeholder="Any additional notes"
                    multiline
                    numberOfLines={3}
                    style={[styles.input, styles.textArea]}
                  />
                )}

                <View style={[styles.row, { justifyContent: "flex-end", gap: 8, marginTop: 8 }]}>
                  <Pressable
                    style={styles.btnOutline}
                    onPress={() => setOpenEditVehicle(false)}
                  >
                    <Text>Cancel</Text>
                  </Pressable>

                  <SolidButton
                    onPress={handleUpdateVehicle}
                    disabled={!editVehicleData?.registrationNo}
                  >
                    <Text style={[styles.btnSolidText, { color: "#111" }]}>
                      Update Vehicle
                    </Text>
                  </SolidButton>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

/* ===================== Small UI bits ===================== */

function AssignMenu({
  riders,
  onPick,
}: {
  riders: Rider[];
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  
  if (!open) {
    return (
      <Pressable style={styles.btnOutlineSm} onPress={() => setOpen(true)}>
        <Feather name="user-plus" size={14} />
        <Text style={{ marginLeft: 4 }}> Assign Rider</Text>
      </Pressable>
    );
  }
  
  return (
    <View style={styles.assignMenuContainer}>
      <View style={styles.assignMenu}>
        {riders.map((r) => (
          <Pressable
            key={r.id}
            style={styles.assignRow}
            onPress={() => {
              onPick(r.name);
              setOpen(false);
            }}
          >
            <Feather name="user-plus" size={14} />
            <Text style={{ marginLeft: 8 }}> {r.name}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[
            styles.assignRow,
            { borderTopWidth: 1, borderColor: "#e5e7eb" },
          ]}
          onPress={() => setOpen(false)}
        >
          <Feather name="x" size={14} />
          <Text style={{ marginLeft: 8 }}> Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | VehicleStatus;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ===================== Styles ===================== */

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },

  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280", fontSize: 14 },
  subtleSmall: { color: "#6b7280", fontSize: 12 },

  row: { flexDirection: "row" },
  rowWithGap: { flexDirection: "row", gap: 12 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  flex1: { flex: 1 },

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
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },

  label: { fontWeight: "700", color: "#111827", fontSize: 14 },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  btnSolid: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSolidText: { fontWeight: "700", fontSize: 14 },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
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
    backgroundColor: "#fff",
  },

  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  segmentBtnActive: { backgroundColor: "#111827" },
  segmentText: { fontWeight: "600", color: "#111827", fontSize: 13 },
  segmentTextActive: { color: "#fff" },

  assignMenuContainer: {
    position: "relative",
  },
  assignMenu: {
    position: "absolute",
    top: 30,
    right: 0,
    width: 180,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    maxHeight: "90%",
    width: "100%",
    alignSelf: "center",
  },

  serviceRow: {
    borderWidth: 1,
    borderColor: "#eceff3",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 10,
  },
  serviceTitle: { fontWeight: "700", color: "#111827", fontSize: 13 },
  serviceCost: { fontWeight: "700", color: "#111827", fontSize: 13 },

  actionButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    flexShrink: 1,
  },
});