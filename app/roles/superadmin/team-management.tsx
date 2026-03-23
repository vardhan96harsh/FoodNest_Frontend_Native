// -----------------------------------------------------------
// TEAM MANAGEMENT  •  WITH ROUTES AND DELETE FUNCTIONALITY
// -----------------------------------------------------------
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";

// -----------------------------------------------------------
// TYPES
// -----------------------------------------------------------
type Member = { id: string; name: string; email?: string };

type ApiTeam = {
  _id: string;
  name: string;
  supervisors: Member[];
  riders: Member[];
  cooks: Member[];
  refillCoordinators: Member[];
  vehicles: Member[];
  batteries: Member[];
  routes: Member[];
  createdAt: string;
};

// -----------------------------------------------------------
// HELPERS
// -----------------------------------------------------------
const normalizeUsers = (data: any): Member[] => {
  const arr =
    data?.users || data?.items || (Array.isArray(data) ? data : []) || [];

  return arr.map((u: any) => ({
    id: String(u._id || u.id),
    name: u.name || u.fullName || u.email || "User",
  }));
};

const normalizeVehicles = (data: any): Member[] => {
  const arr = data?.items || data || [];
  return arr.map((v: any) => ({
    id: String(v._id),
    name: v.registrationNo || v.name || "Vehicle",
  }));
};

const normalizeBatteries = (data: any): Member[] => {
  const arr = data?.items || data || [];
  return arr.map((b: any) => ({
    id: String(b._id),
    name: b.imei || "Battery",
  }));
};

const normalizeRoutes = (data: any): Member[] => {
  const arr = data?.routes || data || [];
  return arr.map((r: any) => ({
    id: String(r._id || r.id),
    name: r.name || `Route ${String(r._id).slice(-4)}`,
  }));
};

// -----------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------
export default function TeamManagement() {
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);

  // FORM FIELDS
  const [teamName, setTeamName] = useState("");
  const [selSupIds, setSelSupIds] = useState<string[]>([]);
  const [selRidIds, setSelRidIds] = useState<string[]>([]);
  const [selCookIds, setSelCookIds] = useState<string[]>([]);
  const [selRefillCorIds, setSelRefillCorIds] = useState<string[]>([]);
  const [selVehicleIds, setSelVehicleIds] = useState<string[]>([]);
  const [selBatteryIds, setSelBatteryIds] = useState<string[]>([]);
  const [selRouteIds, setSelRouteIds] = useState<string[]>([]);
  
  // DROPDOWN OPTIONS
  const [supOptions, setSupOptions] = useState<Member[]>([]);
  const [riderOptions, setRiderOptions] = useState<Member[]>([]);
  const [cookOptions, setCookOptions] = useState<Member[]>([]);
  const [refillCorOptions, setRefillCorOptions] = useState<Member[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<Member[]>([]);
  const [batteryOptions, setBatteryOptions] = useState<Member[]>([]);
  const [routeOptions, setRouteOptions] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  // -----------------------------------------------------------
  // UTILS
  // -----------------------------------------------------------
  const toggle = (
    list: string[],
    id: string,
    setter: (v: string[]) => void
  ) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const resetForm = () => {
    setTeamName("");
    setSelSupIds([]);
    setSelRidIds([]);
    setSelCookIds([]);
    setSelRefillCorIds([]);
    setSelVehicleIds([]);
    setSelBatteryIds([]);
    setSelRouteIds([]);
    setEditingTeam(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (team: ApiTeam) => {
    setEditingTeam(team);
    setTeamName(team.name);

    setSelSupIds(team.supervisors.map((x) => x.id));
    setSelRidIds(team.riders.map((x) => x.id));
    setSelCookIds(team.cooks.map((x) => x.id));
    setSelRefillCorIds(team.refillCoordinators.map((x) => x.id));
    setSelVehicleIds(team.vehicles.map((x) => x.id));
    setSelBatteryIds(team.batteries.map((x) => x.id));
    setSelRouteIds(team.routes?.map((x) => x.id) || []);

    setOpen(true);
  };



const handleDelete = async (team: ApiTeam) => {
  try {
    setDeleteLoading(team._id);
    
    console.log("1. Sending delete for:", team._id);
    const response = await api.delete(`/api/admin/teams/${team._id}`);
    console.log("2. Raw response:", response);
    console.log("3. Response type:", typeof response);
    console.log("4. Response keys:", Object.keys(response));
    
    // Check if delete was successful
    if (response?.status === 200 || response?.status === 204 || response?.data?.success) {
      console.log("5. Delete successful");
      
      // Update UI
      setTeams(current => {
        const filtered = current.filter(t => t._id !== team._id);
        console.log("6. Teams after filter:", filtered.length);
        return filtered;
      });
      
      Alert.alert("Success", "Team deleted");
    } else {
      throw new Error("Delete failed");
    }
    
  } catch (error) {
    console.log("Delete error:", error);
    Alert.alert("Error", "Failed to delete team");
    // Reload to ensure UI matches server
    await loadTeams();
  } finally {
    setDeleteLoading(null);
  }
};
  // -----------------------------------------------------------
  // LOAD TEAMS
  // -----------------------------------------------------------
  const loadTeams = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/teams");
      const raw = res.items || [];

      const normalized = raw.map((t: any) => ({
        _id: t._id ?? t.id,
        name: t.name,
        supervisors: t.supervisors || [],
        riders: t.riders || [],
        cooks: t.cooks || [],
        refillCoordinators: t.refillCoordinators || [],
        vehicles: t.vehicles || [],
        batteries: t.batteries || [],
        routes: t.routes || [],
        createdAt: t.created || t.createdAt || null,
      }));

      setTeams(normalized);
    } catch (e) {
      Alert.alert("Error", "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };
  
  // -----------------------------------------------------------
  // GET ALREADY ASSIGNED IDs (PREVENT DOUBLE ASSIGNMENT)
  // -----------------------------------------------------------
  const getAssignedIds = () => {
    const assigned = {
      supervisors: new Set<string>(),
      riders: new Set<string>(),
      cooks: new Set<string>(),
      refillCoordinators: new Set<string>(),
      vehicles: new Set<string>(),
      batteries: new Set<string>(),
      routes: new Set<string>(),
    };

    teams.forEach((t) => {
      // When editing, do not block this team's existing items
      if (editingTeam && editingTeam._id === t._id) return;

      t.supervisors.forEach((x) => assigned.supervisors.add(x.id));
      t.riders.forEach((x) => assigned.riders.add(x.id));
      t.cooks.forEach((x) => assigned.cooks.add(x.id));
      t.refillCoordinators.forEach((x) =>
        assigned.refillCoordinators.add(x.id)
      );
      t.vehicles.forEach((x) => assigned.vehicles.add(x.id));
      t.batteries.forEach((x) => assigned.batteries.add(x.id));
      t.routes?.forEach((x) => assigned.routes.add(x.id));
    });

    return assigned;
  };

// -----------------------------------------------------------
// LOAD USERS / VEHICLES / BATTERIES / ROUTES
// -----------------------------------------------------------
const loadOptions = async () => {
  try {
    const [sup, rid, cook, refCor, vehicles, batteries, routesRes] = await Promise.all([
      api.get("/api/admin/users?role=supervisor"),
      api.get("/api/admin/users?role=rider"),
      api.get("/api/admin/users?role=cook"),
      api.get("/api/admin/users?role=refill"),
      api.get("/api/vehicles"),
      api.get("/api/batteries"),
      api.get("/api/admin/routes/list"),
    ]);

    // normalize
    let supList = normalizeUsers(sup);
    let ridList = normalizeUsers(rid);
    let cookList = normalizeUsers(cook);
    let refillList = normalizeUsers(refCor);
    let vehicleList = normalizeVehicles(vehicles);
    let batteryList = normalizeBatteries(batteries);
    let routeList = normalizeRoutes(routesRes);

    // filter items already assigned (EXCEPT ROUTES - they can be shared)
    const assigned = getAssignedIds();

    supList = supList.filter(
      (p) => !assigned.supervisors.has(p.id) || selSupIds.includes(p.id)
    );

    ridList = ridList.filter(
      (p) => !assigned.riders.has(p.id) || selRidIds.includes(p.id)
    );

    cookList = cookList.filter(
      (p) => !assigned.cooks.has(p.id) || selCookIds.includes(p.id)
    );

    refillList = refillList.filter(
      (p) =>
        !assigned.refillCoordinators.has(p.id) ||
        selRefillCorIds.includes(p.id)
    );

    vehicleList = vehicleList.filter(
      (p) => !assigned.vehicles.has(p.id) || selVehicleIds.includes(p.id)
    );

    batteryList = batteryList.filter(
      (p) => !assigned.batteries.has(p.id) || selBatteryIds.includes(p.id)
    );

    // ROUTES: No filtering - they can be shared between teams
    // routeList = routeList.filter(
    //   (p) => !assigned.routes.has(p.id) || selRouteIds.includes(p.id)
    // );

    // update UI options
    setSupOptions(supList);
    setRiderOptions(ridList);
    setCookOptions(cookList);
    setRefillCorOptions(refillList);
    setVehicleOptions(vehicleList);
    setBatteryOptions(batteryList);
    setRouteOptions(routeList); // All routes shown, no filtering
  } catch (e) {
    console.error("Load options error:", e);
    Alert.alert("Error", "Failed to load dropdown options");
  }
};

  // -----------------------------------------------------------
  // SUBMIT FORM (WITH ROUTES)
  // -----------------------------------------------------------
  const submit = async () => {
    try {
      // Validate team name
      if (!teamName.trim()) {
        Alert.alert("Error", "Team name is required");
        return;
      }

      // Filter out any empty or invalid IDs
      const validSupIds = selSupIds.filter(id => id && id.length > 0);
      const validRidIds = selRidIds.filter(id => id && id.length > 0);
      const validCookIds = selCookIds.filter(id => id && id.length > 0);
      const validRefillIds = selRefillCorIds.filter(id => id && id.length > 0);
      const validVehicleIds = selVehicleIds.filter(id => id && id.length > 0);
      const validBatteryIds = selBatteryIds.filter(id => id && id.length > 0);
      const validRouteIds = selRouteIds.filter(id => id && id.length > 0);

      const payload = {
        name: teamName.trim(),
        supervisors: validSupIds,
        riders: validRidIds,
        cooks: validCookIds,
        refillCoordinators: validRefillIds,
        vehicles: validVehicleIds,
        batteries: validBatteryIds,
        routes: validRouteIds,
      };

      console.log("Submitting payload:", JSON.stringify(payload, null, 2));

      if (editingTeam) {
        await api.patch(`/api/admin/teams/${editingTeam._id}`, payload);
        Alert.alert("Success", "Team updated successfully");
      } else {
        await api.post("/api/admin/teams", payload);
        Alert.alert("Success", "Team created successfully");
      }

      setOpen(false);
      resetForm();
      loadTeams();
    } catch (e: any) {
      console.error("Submission error:", e);
      Alert.alert("Error", e.message || "Failed to save team");
    }
  };

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);

    // Load teams first, then filter options
    loadTeams().then(() => {
      loadOptions();
    });
  }, [loaded]);

  useEffect(() => {
    if (loaded) {
      loadOptions();
    }
  }, [teams, editingTeam]);

  // -----------------------------------------------------------
  // UI
  // -----------------------------------------------------------
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Teams Management</Text>

        <LinearGradient
          colors={["#facc15", "#f59e0b"]}
          style={styles.btnGradient}
        >
          <Pressable onPress={openCreate} style={styles.btnGradientInner}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.btnGradientText}> Create Team</Text>
          </Pressable>
        </LinearGradient>
      </View>

      {/* TEAM LIST */}
      <View style={{ gap: 12 }}>
        {loading ? (
          <ActivityIndicator size="large" />
        ) : teams.length === 0 ? (
          <Text style={styles.emptyText}>No teams found. Create your first team!</Text>
        ) : (
          teams.map((team) => (
            <View key={team._id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.teamName}>{team.name}</Text>
                <View style={styles.actionButtons}>
                  <Pressable
                    onPress={() => openEdit(team)}
                    style={[styles.btnOutline, styles.editButton]}
                  >
                    <Text>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(team)}
                    style={[styles.btnOutline, styles.deleteButton]}
                    disabled={deleteLoading === team._id}
                  >
                    {deleteLoading === team._id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    )}
                  </Pressable>
                </View>
              </View>

              <TeamSection
                title="Supervisors"
                data={team.supervisors}
                color="#1d4ed8"
              />
              <TeamSection title="Riders" data={team.riders} color="#047857" />
              <TeamSection title="Cooks" data={team.cooks} color="#c2410c" />
              <TeamSection
                title="Refill Coordinators"
                data={team.refillCoordinators}
                color="#7c3aed"
              />
              <TeamSection
                title="Vehicles"
                data={team.vehicles}
                color="#0284c7"
              />
              <TeamSection
                title="Batteries"
                data={team.batteries}
                color="#6b7280"
              />
              <TeamSection
                title="Routes"
                data={team.routes || []}
                color="#8b5cf6"
              />
            </View>
          ))
        )}
      </View>

      {/* MODAL */}
      <Modal visible={open} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingTeam ? "Edit Team" : "Create Team"}
            </Text>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={styles.label}>Team Name</Text>
                <TextInput
                  value={teamName}
                  onChangeText={setTeamName}
                  style={styles.input}
                  placeholder="Enter team name"
                />
              </View>

              <PickerGroup
                title="Supervisors"
                people={supOptions}
                selected={selSupIds}
                onToggle={(id) => toggle(selSupIds, id, setSelSupIds)}
              />
              <PickerGroup
                title="Riders"
                people={riderOptions}
                selected={selRidIds}
                onToggle={(id) => toggle(selRidIds, id, setSelRidIds)}
              />
              <PickerGroup
                title="Cooks"
                people={cookOptions}
                selected={selCookIds}
                onToggle={(id) => toggle(selCookIds, id, setSelCookIds)}
              />
              <PickerGroup
                title="Refill Coordinators"
                people={refillCorOptions}
                selected={selRefillCorIds}
                onToggle={(id) =>
                  toggle(selRefillCorIds, id, setSelRefillCorIds)
                }
              />

              <PickerGroup
                title="Vehicles"
                people={vehicleOptions}
                selected={selVehicleIds}
                onToggle={(id) => toggle(selVehicleIds, id, setSelVehicleIds)}
              />
              <PickerGroup
                title="Batteries"
                people={batteryOptions}
                selected={selBatteryIds}
                onToggle={(id) => toggle(selBatteryIds, id, setSelBatteryIds)}
              />

              <PickerGroup
                title="Routes"
                people={routeOptions}
                selected={selRouteIds}
                onToggle={(id) => toggle(selRouteIds, id, setSelRouteIds)}
              />

              <View style={styles.rowBetween}>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  <Text>Cancel</Text>
                </Pressable>

                <Pressable 
                  style={[styles.btnSolid, !teamName.trim() && styles.btnDisabled]} 
                  onPress={submit}
                  disabled={!teamName.trim()}
                >
                  <Text style={styles.btnSolidText}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// -----------------------------------------------------------
// TEAM SECTION UI
// -----------------------------------------------------------
function TeamSection({
  title,
  data,
  color,
}: {
  title: string;
  data: Member[];
  color: string;
}) {
  if (!data || data.length === 0) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontWeight: "700" }}>{title}:</Text>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}
      >
        {data.map((m, i) => (
          <View
            key={i}
            style={{
              backgroundColor: color,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{m.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// -----------------------------------------------------------
// PICKER GROUP
// -----------------------------------------------------------
function PickerGroup({
  title,
  people,
  selected,
  onToggle,
}: {
  title: string;
  people: Member[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.listWrap}>
        {people.length === 0 ? (
          <Text style={{ padding: 12, color: "#6b7280" }}>No options available</Text>
        ) : (
          people.map((p, idx) => {
            const checked = selected.includes(p.id);
            return (
              <View key={p.id}>
                <Pressable
                  onPress={() => onToggle(p.id)}
                  style={styles.listRow}
                >
                  <Feather
                    name={checked ? "check-square" : "square"}
                    size={18}
                    color={checked ? "#2563eb" : "#6b7280"}
                  />
                  <Text style={{ marginLeft: 8, fontWeight: checked ? "600" : "400" }}>
                    {p.name}
                  </Text>
                </Pressable>

                {idx < people.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------
// STYLES
// -----------------------------------------------------------
const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: "#f9fafb", gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 22, fontWeight: "800" },
  emptyText: { textAlign: "center", color: "#6b7280", padding: 20 },

  btnGradient: { borderRadius: 12 },
  btnGradientInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
  },
  btnGradientText: { color: "#fff", fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },

  teamName: { fontSize: 18, fontWeight: "800" },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  actionButtons: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  editButton: {
    marginRight: 4,
  },

  deleteButton: {
    borderColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  btnOutline: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  btnSolid: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  
  btnDisabled: {
    backgroundColor: "#9ca3af",
    opacity: 0.5,
  },

  btnSolidText: { color: "#fff", fontWeight: "700" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
    padding: 16,
  },

  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    maxHeight: "90%",
  },

  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12 },

  label: { fontWeight: "700", marginBottom: 4 },

  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },

  listWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
  },

  divider: { height: 1, backgroundColor: "#e5e7eb" },
});