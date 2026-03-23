// screens/RequestMore.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------- Types ---------- */
type FoodItem = {
  _id: string;
  name: string;
  price: number;
  category: string;
  unit?: string;
  imageUrl?: string;
};

type InventoryItem = {
  foodItem: FoodItem;
  quantityRemaining: number;
  quantityAssigned: number;
  quantitySold: number;
};

type Assignment = {
  _id: string;
  route: { name: string };
  inventory: InventoryItem[];
  status: string;
};

type RefillRequest = {
  _id: string;
  rider: { _id: string; name: string };
  items: Array<{
    foodItem: FoodItem;
    name: string;
    quantity: number;
    price: number;
  }>;
  reason: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  status: string;
  requestedAt: string;
  supervisor?: { name: string };
  cook?: { name: string };
  refillCoordinator?: { name: string };
  history: Array<{
    status: string;
    updatedBy: { name: string };
    updatedAt: string;
    notes?: string;
  }>;
};

/* ---------- Constants ---------- */
const tone = {
  primary: "#2563eb",
  success: "#059669",
  warning: "#d97706",
  gray: "#6b7280",
  destructive: "#dc2626",
  info: "#0891b2",
} as const;

const statusColors: Record<string, string> = {
  Pending: tone.warning,
  Approved: tone.primary,
  Rejected: tone.destructive,
  CookPreparing: tone.info,
  ReadyForPickup: tone.success,
  AssignedToRefill: tone.primary,
  OutForDelivery: tone.info,
  Delivered: tone.success,
};

const urgencyColors = {
  Low: tone.gray,
  Medium: tone.primary,
  High: tone.warning,
  Critical: tone.destructive,
};

/* ---------- Components ---------- */
function Badge({ text, color, variant = "solid" }: { text: string; color: string; variant?: "solid" | "outline" }) {
  const solid = variant === "solid";
  return (
    <View style={[styles.badge, { backgroundColor: solid ? color : "transparent", borderColor: color }]}>
      <Text style={{ color: solid ? "#fff" : color, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function PickerSheet<T extends { _id: string; name: string }>({
  visible,
  title,
  options,
  onSelect,
  onClose,
  renderRight,
}: {
  visible: boolean;
  title: string;
  options: T[];
  onSelect: (o: T) => void;
  onClose: () => void;
  renderRight?: (o: T) => React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose}><Feather name="x" size={20} /></Pressable>
        </View>
        <ScrollView>
          {options.length === 0 ? (
            <Text style={styles.emptyText}>No items available</Text>
          ) : (
            options.map((o) => (
              <Pressable
                key={o._id}
                style={styles.optionRow}
                onPress={() => { onSelect(o); onClose(); }}
              >
                <Text style={styles.optionText}>{o.name}</Text>
                {renderRight ? <View>{renderRight(o)}</View> : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function RequestMoreScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data states
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [requests, setRequests] = useState<RefillRequest[]>([]);
  
  // 🔴 FIXED: This will now come from assignment.inventory
  const [assignedItems, setAssignedItems] = useState<Array<{ foodItem: FoodItem; remaining: number }>>([]);

  // Form states
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ foodItem: FoodItem; remaining: number } | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [urgencyPickerOpen, setUrgencyPickerOpen] = useState(false);

  // Selected request for details
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Urgency options
  const urgencyOptions = [
    { _id: "Low", name: "Low - Can wait" },
    { _id: "Medium", name: "Medium - Running low" },
    { _id: "High", name: "High - Almost out" },
    { _id: "Critical", name: "Critical - Completely out" },
  ];

  // ========== Fetch Data ==========
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Get rider's active assignment
      const assignmentRes = await api.get("/api/rider/assignments/today");
      
      if (assignmentRes.ok && assignmentRes.assignment) {
        setAssignment(assignmentRes.assignment);
        
        // 🔴 FIXED: Extract assigned food items with their remaining quantities
        const items = assignmentRes.assignment.inventory.map((item: InventoryItem) => ({
          foodItem: item.foodItem,
          remaining: item.quantityRemaining
        }));
        setAssignedItems(items);
      }

      // 2. Get rider's refill requests
      const requestsRes = await api.get("/api/refill-requests/rider/my-requests");
      if (requestsRes.ok) {
        setRequests(requestsRes.requests);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ========== Submit Request ==========
  const submitRequest = async () => {
    if (!selectedItem) {
      Alert.alert("Error", "Please select a food item");
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    if (qty > selectedItem.remaining) {
      Alert.alert("Error", `You only have ${selectedItem.remaining} items remaining. Cannot request more than that.`);
      return;
    }

    if (!reason.trim()) {
      Alert.alert("Error", "Please provide a reason");
      return;
    }

    if (!assignment) {
      Alert.alert("Error", "No active assignment found");
      return;
    }

    try {
      setSaving(true);

      const response = await api.post("/api/refill-requests/rider/create", {
        assignmentId: assignment._id,
        items: [{
          foodItemId: selectedItem.foodItem._id,
          quantity: qty
        }],
        reason: reason.trim(),
        urgency,
        location: null
      });

      if (response.ok) {
        Alert.alert("Success", "Refill request sent to supervisor");
        
        // Reset form
        setSelectedItem(null);
        setQuantity("");
        setReason("");
        setUrgency("Medium");
        
        // Refresh data
        fetchData();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  // ========== View Request Details ==========
  const viewRequestDetails = async (requestId: string) => {
    try {
      const response = await api.get(`/api/refill-requests/${requestId}/track`);
      if (response.ok && response.request) {
        setSelectedRequest(response.request);
        setDetailsModalOpen(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load request details");
    }
  };

  // ========== Format Time ==========
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center", flex: 1 }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12, color: tone.gray }}>Loading your inventory...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View>
        <Text style={styles.h1}>Request Refill</Text>
        <Text style={styles.subtle}>
          {assignment ? `Route: ${assignment.route?.name}` : "No active route"}
        </Text>
      </View>

      {/* No Assignment Warning */}
      {!assignment && (
        <View style={[styles.card, { backgroundColor: '#fff3cd', borderColor: '#ffeeba' }]}>
          <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
            <Feather name="alert-triangle" size={18} color={tone.warning} />
            <Text style={[styles.sectionTitle, { color: '#856404' }]}>No Active Route</Text>
          </View>
          <Text style={{ color: '#856404', marginTop: 4 }}>
            You don't have an active assignment. Only items from your current inventory can be requested.
          </Text>
        </View>
      )}

      {/* Form - Only show if assignment exists */}
      {assignment && (
        <View style={{ gap: 12 }}>
          {/* New Request Form */}
          <View style={styles.card}>
            <View style={{ marginBottom: 8 }}>
              <View style={[styles.row, { alignItems: "center", gap: 8 }]}>
                <Feather name="plus" size={18} color={tone.primary} />
                <Text style={styles.sectionTitle}>New Request</Text>
              </View>
              <Text style={styles.subtle}>Request refill for items in your inventory</Text>
            </View>

            {/* 🔴 FIXED: Item dropdown now shows only assigned items */}
            <Text style={styles.label}>Food Item (from your inventory)</Text>
            <Pressable style={styles.inputLike} onPress={() => setItemOpen(true)}>
              <Text style={selectedItem ? styles.inputValue : styles.inputPlaceholder}>
                {selectedItem ? selectedItem.foodItem.name : "Select food item"}
              </Text>
              <Feather name="chevron-down" size={18} color={tone.gray} />
            </Pressable>

            {/* Show remaining quantity when item selected */}
            {selectedItem && (
              <View style={styles.remainingInfo}>
                <Text style={styles.remainingLabel}>Currently have:</Text>
                <Badge 
                  text={`${selectedItem.remaining} left`} 
                  color={selectedItem.remaining < 5 ? tone.destructive : tone.success} 
                  variant="solid" 
                />
              </View>
            )}

            {/* Quantity */}
            <View style={{ height: 12 }} />
            <Text style={styles.label}>Quantity Requested</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Enter quantity needed"
              value={quantity}
              onChangeText={(t) => setQuantity(t.replace(/[^\d]/g, ""))}
              style={styles.textInput}
            />

            {/* Urgency */}
            <View style={{ height: 12 }} />
            <Text style={styles.label}>Urgency Level</Text>
            <Pressable style={styles.inputLike} onPress={() => setUrgencyPickerOpen(true)}>
              <Text style={urgency ? styles.inputValue : styles.inputPlaceholder}>
                {urgency ? urgencyOptions.find(u => u._id === urgency)?.name : "Select urgency"}
              </Text>
              <Feather name="chevron-down" size={18} color={tone.gray} />
            </Pressable>

            {/* Reason */}
            <View style={{ height: 12 }} />
            <Text style={styles.label}>Reason for Request</Text>
            <TextInput
              placeholder="Explain why you need more items"
              value={reason}
              onChangeText={setReason}
              style={[styles.textArea]}
              multiline
              numberOfLines={4}
            />

            {/* Submit */}
            <Pressable
              onPress={submitRequest}
              disabled={!selectedItem || !quantity || !reason || saving}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!selectedItem || !quantity || !reason || saving || pressed) && { opacity: 0.7 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Send Request to Supervisor</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* 🔴 FIXED: Quick Request for Low Stock Items */}
          {assignedItems.filter(i => i.remaining < 10).length > 0 && (
            <View style={styles.card}>
              <View style={[styles.row, { alignItems: "center", gap: 8, marginBottom: 8 }]}>
                <Feather name="alert-circle" size={18} color={tone.warning} />
                <Text style={styles.sectionTitle}>Low Stock Items</Text>
              </View>
              <Text style={styles.subtle}>Tap to quickly request these items</Text>
              
              <View style={styles.chipContainer}>
                {assignedItems
                  .filter(i => i.remaining < 10)
                  .map((item) => (
                    <Pressable
                      key={item.foodItem._id}
                      style={styles.chip}
                      onPress={() => {
                        setSelectedItem(item);
                        // Suggest requesting enough to bring stock to 20
                        const suggestQty = Math.max(5, 20 - item.remaining);
                        setQuantity(String(suggestQty));
                      }}
                    >
                      <Text style={styles.chipText}>{item.foodItem.name}</Text>
                      <Text style={[styles.chipSubtext, { color: item.remaining < 3 ? tone.destructive : tone.warning }]}>
                        {item.remaining} left
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}

          {/* Current Inventory Summary */}
          <View style={styles.card}>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Your Current Inventory</Text>
              <Text style={styles.subtle}>Items you have right now</Text>
            </View>

            <View style={styles.listWrap}>
              {assignedItems.map((item, idx) => (
                <View key={item.foodItem._id}>
                  <View style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listLeft}>{item.foodItem.name}</Text>
                      <Text style={styles.subtleSmall}>Price: ₹{item.foodItem.price}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Badge 
                        text={`${item.remaining} left`} 
                        color={item.remaining < 5 ? tone.destructive : item.remaining < 10 ? tone.warning : tone.success} 
                        variant="solid" 
                      />
                    </View>
                  </View>
                  {idx < assignedItems.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Request History */}
      <View style={styles.card}>
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Request History</Text>
          <Text style={styles.subtle}>Your previous refill requests</Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={40} color={tone.gray} />
            <Text style={styles.emptyText}>No requests yet</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {requests.map((req, idx) => {
              const totalItems = req.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <Pressable
                  key={req._id}
                  onPress={() => viewRequestDetails(req._id)}
                >
                  <View style={[styles.listRow, { alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.row, { alignItems: "center", gap: 6, flexWrap: 'wrap' }]}>
                        <Text style={styles.listLeft}>
                          {req.items.length} item{req.items.length > 1 ? 's' : ''}
                        </Text>
                        <Badge 
                          text={req.urgency} 
                          color={urgencyColors[req.urgency]} 
                          variant="solid" 
                        />
                      </View>
                      <Text style={styles.subtleSmall}>
                        Total: {totalItems} items • {formatTime(req.requestedAt)}
                      </Text>
                      <Text style={[styles.subtleSmall, { marginTop: 4 }]} numberOfLines={2}>
                        {req.reason}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Badge 
                        text={req.status} 
                        color={statusColors[req.status] || tone.gray} 
                        variant="solid" 
                      />
                    </View>
                  </View>
                  {idx < requests.length - 1 ? <View style={styles.divider} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* 🔴 FIXED: Item Picker - Now shows only assigned items */}
      <PickerSheet
        visible={itemOpen}
        title="Select from your inventory"
        options={assignedItems.map(item => ({
          _id: item.foodItem._id,
          name: item.foodItem.name,
          remaining: item.remaining
        }))}
        onSelect={(o) => {
          const selected = assignedItems.find(i => i.foodItem._id === o._id);
          if (selected) setSelectedItem(selected);
        }}
        onClose={() => setItemOpen(false)}
        renderRight={(o) => {
          const item = assignedItems.find(i => i.foodItem._id === o._id);
          return (
            <Badge 
              text={`${item?.remaining || 0} left`} 
              color={item?.remaining && item.remaining < 5 ? tone.destructive : tone.gray} 
              variant="outline" 
            />
          );
        }}
      />

      {/* Urgency Picker */}
      <PickerSheet
        visible={urgencyPickerOpen}
        title="Select urgency level"
        options={urgencyOptions}
        onSelect={(o) => setUrgency(o._id as any)}
        onClose={() => setUrgencyPickerOpen(false)}
        renderRight={(o) => (
          <Badge 
            text={o._id} 
            color={urgencyColors[o._id as keyof typeof urgencyColors]} 
            variant="solid" 
          />
        )}
      />

      {/* Request Details Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={detailsModalOpen}
        onRequestClose={() => setDetailsModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailsModalOpen(false)} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <Pressable onPress={() => setDetailsModalOpen(false)}>
              <Feather name="x" size={22} color={tone.gray} />
            </Pressable>
          </View>

          {selectedRequest && (
            <ScrollView style={{ maxHeight: '90%' }}>
              {/* Status */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Status</Text>
                <Badge 
                  text={selectedRequest.status} 
                  color={statusColors[selectedRequest.status] || tone.gray} 
                  variant="solid" 
                />
              </View>

              {/* Items */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Items Requested</Text>
                {selectedRequest.items.map((item, idx) => (
                  <View key={idx} style={styles.modalItemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                  </View>
                ))}
              </View>

              {/* Details */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Urgency:</Text>
                  <Badge 
                    text={selectedRequest.urgency} 
                    color={urgencyColors[selectedRequest.urgency]} 
                    variant="solid" 
                  />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reason:</Text>
                  <Text style={styles.detailValue}>{selectedRequest.reason}</Text>
                </View>
              </View>

              {/* Timeline */}
              {selectedRequest.history?.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Timeline</Text>
                  {selectedRequest.history.map((event, idx) => (
                    <View key={idx} style={styles.timelineItem}>
                      <Badge text={event.status} color={statusColors[event.status] || tone.gray} variant="solid" />
                      <Text style={styles.timelineTime}>{formatTime(event.updatedAt)}</Text>
                      {event.notes && <Text style={styles.timelineNotes}>{event.notes}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          <Pressable
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() => setDetailsModalOpen(false)}
          >
            <Text style={styles.primaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: "#f9fafb", minHeight: '100%' },

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

  label: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
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

  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontWeight: "600",
    color: "#111827",
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "600",
    color: "#111827",
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },

  remainingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  remainingLabel: {
    fontSize: 11,
    color: "#6b7280",
  },

  listWrap: { borderWidth: 1, borderColor: "#eef1f5", borderRadius: 12, overflow: "hidden" },
  listRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listLeft: { fontWeight: "700", color: "#111827" },
  divider: { height: 1, backgroundColor: "#eef1f5" },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  primaryBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  optionText: { fontSize: 14, color: "#111827", fontWeight: "600" },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipText: { fontWeight: "600", color: "#111827" },
  chipSubtext: { fontSize: 10, marginTop: 2 },

  emptyContainer: {
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  modalCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "10%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  modalSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  modalItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  itemName: { flex: 2, fontWeight: "500" },
  itemQuantity: { flex: 1, textAlign: "right", fontWeight: "600" },

  detailRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  detailLabel: {
    width: 60,
    fontSize: 12,
    color: "#6b7280",
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  timelineItem: {
    marginBottom: 8,
  },
  timelineTime: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 11,
    color: "#374151",
    marginTop: 2,
  },
});