// app/roles/supervisor/RefillRequests.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";

/* ---------- Types ---------- */
type FoodItem = {
  _id: string;
  name: string;
  price: number;
  unit?: string;
};

type RefillRequest = {
  _id: string;
  rider: {
    _id: string;
    name: string;
  };
  assignment?: {
    route?: {
      name: string;
    };
  };
  items: Array<{
    foodItem: FoodItem;
    name: string;
    quantity: number;
    price: number;
    unit?: string;
  }>;
  reason: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  status: string;
  requestedAt: string;
  createdAt: string;
  supervisorNotes?: string;
  cook?: { _id: string; name: string };
  refillCoordinator?: { _id: string; name: string };
  history?: Array<{
    status: string;
    updatedBy: { name: string };
    updatedAt: string;
    notes?: string;
  }>;
};

type Cook = {
  _id: string;
  name: string;
  email: string;
};

type Team = {
  cooks: Cook[];
};

/* ---------- Constants ---------- */
const tone = {
  primary: "#2563eb",
  success: "#059669",
  warning: "#d97706",
  destructive: "#dc2626",
  gray: "#6b7280",
  info: "#0891b2",
};

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
    <View
      style={[
        styles.badge,
        { backgroundColor: solid ? color : "transparent", borderColor: color },
      ]}
    >
      <Text style={{ color: solid ? "#fff" : color, fontSize: 11, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

function CookPickerModal({
  visible,
  onClose,
  cooks,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  cooks: Cook[];
  onSelect: (cook: Cook) => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Cook</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={tone.gray} />
          </Pressable>
        </View>
        <ScrollView>
          {cooks.length === 0 ? (
            <Text style={styles.emptyText}>No cooks available in your team</Text>
          ) : (
            cooks.map((cook) => (
              <Pressable
                key={cook._id}
                style={styles.cookItem}
                onPress={() => {
                  onSelect(cook);
                  onClose();
                }}
              >
                <View>
                  <Text style={styles.cookName}>{cook.name}</Text>
                  <Text style={styles.cookEmail}>{cook.email}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={tone.gray} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function RequestDetailsModal({
  visible,
  onClose,
  request,
  onApprove,
  onReject,
  cooks,
}: {
  visible: boolean;
  onClose: () => void;
  request: RefillRequest | null;
  onApprove: (requestId: string, cookId: string, notes: string) => void;
  onReject: (requestId: string, reason: string) => void;
  cooks: Cook[];
}) {
  const [selectedCook, setSelectedCook] = useState<Cook | null>(null);
  const [notes, setNotes] = useState("");
  const [cookPickerVisible, setCookPickerVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedCook(null);
      setNotes("");
      setRejectReason("");
      setShowReject(false);
    }
  }, [visible]);

  if (!request) return null;

  const totalQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = request.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalCard, { maxHeight: '80%' }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Request Details</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={tone.gray} />
          </Pressable>
        </View>

        <ScrollView>
          {/* Rider Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Rider</Text>
            <View style={styles.riderInfo}>
              <Feather name="user" size={16} color={tone.primary} />
              <Text style={styles.detailValue}>{request.rider.name}</Text>
            </View>
            {request.assignment?.route && (
              <View style={styles.riderInfo}>
                <Feather name="map-pin" size={16} color={tone.gray} />
                <Text style={styles.subtleText}>Route: {request.assignment.route.name}</Text>
              </View>
            )}
          </View>

          {/* Urgency */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Urgency</Text>
            <Badge 
              text={request.urgency} 
              color={urgencyColors[request.urgency]} 
              variant="solid" 
            />
          </View>

          {/* Items */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Items Requested</Text>
            {request.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price} each</Text>
                </View>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Items:</Text>
              <Text style={styles.totalValue}>{totalQuantity}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Value:</Text>
              <Text style={[styles.totalValue, { color: tone.success }]}>₹{totalValue.toFixed(2)}</Text>
            </View>
          </View>

          {/* Reason */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Reason</Text>
            <Text style={styles.reasonText}>{request.reason}</Text>
          </View>

          {/* Time */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Requested At</Text>
            <Text style={styles.timeText}>{formatTime(request.requestedAt)}</Text>
          </View>

          {/* History */}
          {request.history && request.history.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>History</Text>
              {request.history.map((event, idx) => (
                <View key={idx} style={styles.historyItem}>
                  <Badge text={event.status} color={statusColors[event.status] || tone.gray} variant="solid" />
                  <Text style={styles.historyTime}>{formatTime(event.updatedAt)}</Text>
                  {event.notes && <Text style={styles.historyNotes}>{event.notes}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Approval/Rejection Section */}
          {request.status === "Pending" && (
            <View style={styles.actionSection}>
              {!showReject ? (
                <>
                  <Text style={styles.sectionSubtitle}>Assign to Cook</Text>
                  <Pressable
                    style={styles.cookSelector}
                    onPress={() => setCookPickerVisible(true)}
                  >
                    <Text style={selectedCook ? styles.selectedText : styles.placeholderText}>
                      {selectedCook ? selectedCook.name : "Select a cook"}
                    </Text>
                    <Feather name="chevron-down" size={18} color={tone.gray} />
                  </Pressable>

                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.approveButton, !selectedCook && styles.disabledButton]}
                      onPress={() => selectedCook && onApprove(request._id, selectedCook._id, notes)}
                      disabled={!selectedCook}
                    >
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => setShowReject(true)}
                    >
                      <Feather name="x" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Reject</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.sectionSubtitle}>Reject Request</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Reason for rejection"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                  />
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.rejectButton, !rejectReason && styles.disabledButton]}
                      onPress={() => rejectReason && onReject(request._id, rejectReason)}
                      disabled={!rejectReason}
                    >
                      <Feather name="x" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Confirm Reject</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => setShowReject(false)}
                    >
                      <Text style={styles.cancelButtonText}>Back</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Assigned Info */}
          {request.status !== "Pending" && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Assigned To</Text>
              {request.cook && (
                <View style={styles.assignedRow}>
                  <MaterialCommunityIcons name="chef-hat" size={16} color={tone.info} />
                  <Text style={styles.assignedText}>Cook: {request.cook.name}</Text>
                </View>
              )}
              {request.refillCoordinator && (
                <View style={styles.assignedRow}>
                  <Feather name="truck" size={16} color={tone.primary} />
                  <Text style={styles.assignedText}>Refill: {request.refillCoordinator.name}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <CookPickerModal
          visible={cookPickerVisible}
          onClose={() => setCookPickerVisible(false)}
          cooks={cooks}
          onSelect={setSelectedCook}
        />
      </View>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function RefillRequestsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<RefillRequest[]>([]);
  const [groupedRequests, setGroupedRequests] = useState({
    critical: [] as RefillRequest[],
    high: [] as RefillRequest[],
    medium: [] as RefillRequest[],
    low: [] as RefillRequest[],
  });
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  // Fetch team data to get cooks
  const fetchTeamData = useCallback(async () => {
    try {
      const teamRes = await api.get("/api/supervisor/my-team");
      if (teamRes.ok && teamRes.team) {
        setCooks(teamRes.team.cooks || []);
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    }
  }, []);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await api.get("/api/refill-requests/supervisor/pending");
      if (res.ok) {
        setRequests(res.requests);
        setGroupedRequests(res.grouped);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, []);

  // Fetch all requests
  const fetchAllRequests = useCallback(async () => {
    try {
      const res = await api.get("/api/refill-requests/supervisor/all");
      if (res.ok) {
        setRequests(res.requests);
      }
    } catch (error) {
      console.error("Failed to fetch all requests:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await fetchTeamData();
    if (activeTab === "pending") {
      await fetchPendingRequests();
    } else {
      await fetchAllRequests();
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleApprove = async (requestId: string, cookId: string, notes: string) => {
    try {
      const res = await api.patch(`/api/refill-requests/supervisor/${requestId}/approve`, {
        cookId,
        notes
      });

      if (res.ok) {
        Alert.alert("Success", "Request approved and assigned to cook");
        setDetailsModalVisible(false);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to approve request");
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    try {
      const res = await api.patch(`/api/refill-requests/supervisor/${requestId}/reject`, {
        reason
      });

      if (res.ok) {
        Alert.alert("Success", "Request rejected");
        setDetailsModalVisible(false);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to reject request");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12 }}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View>
        <Text style={styles.h1}>Refill Requests</Text>
        <Text style={styles.subtle}>Manage rider refill requests and assign to cooks</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "pending" && styles.activeTab]}
          onPress={() => setActiveTab("pending")}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}>
            Pending
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "all" && styles.activeTab]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.activeTabText]}>
            All Requests
          </Text>
        </Pressable>
      </View>

      {activeTab === "pending" ? (
        <>
          {/* Critical Requests */}
          {groupedRequests.critical.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="alert" size={18} color={tone.destructive} />
                <Text style={[styles.sectionTitle, { color: tone.destructive }]}>
                  Critical ({groupedRequests.critical.length})
                </Text>
              </View>
              {groupedRequests.critical.map((req) => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onPress={() => {
                    setSelectedRequest(req);
                    setDetailsModalVisible(true);
                  }}
                />
              ))}
            </View>
          )}

          {/* High Urgency */}
          {groupedRequests.high.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={tone.warning} />
                <Text style={[styles.sectionTitle, { color: tone.warning }]}>
                  High ({groupedRequests.high.length})
                </Text>
              </View>
              {groupedRequests.high.map((req) => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onPress={() => {
                    setSelectedRequest(req);
                    setDetailsModalVisible(true);
                  }}
                />
              ))}
            </View>
          )}

          {/* Medium Urgency */}
          {groupedRequests.medium.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="clock" size={18} color={tone.primary} />
                <Text style={[styles.sectionTitle, { color: tone.primary }]}>
                  Medium ({groupedRequests.medium.length})
                </Text>
              </View>
              {groupedRequests.medium.map((req) => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onPress={() => {
                    setSelectedRequest(req);
                    setDetailsModalVisible(true);
                  }}
                />
              ))}
            </View>
          )}

          {/* Low Urgency */}
          {groupedRequests.low.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="chevrons-down" size={18} color={tone.gray} />
                <Text style={[styles.sectionTitle, { color: tone.gray }]}>
                  Low ({groupedRequests.low.length})
                </Text>
              </View>
              {groupedRequests.low.map((req) => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onPress={() => {
                    setSelectedRequest(req);
                    setDetailsModalVisible(true);
                  }}
                />
              ))}
            </View>
          )}

          {requests.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={tone.gray} />
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyText}>All rider requests have been processed</Text>
            </View>
          )}
        </>
      ) : (
        /* All Requests History */
        <View style={styles.historyList}>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={tone.gray} />
              <Text style={styles.emptyTitle}>No Requests</Text>
              <Text style={styles.emptyText}>No refill requests found</Text>
            </View>
          ) : (
            requests.map((req) => (
              <Pressable
                key={req._id}
                style={styles.historyCard}
                onPress={() => {
                  setSelectedRequest(req);
                  setDetailsModalVisible(true);
                }}
              >
                <View style={styles.historyHeader}>
                  <View>
                    <Text style={styles.riderName}>{req.rider.name}</Text>
                    <Text style={styles.requestTime}>{formatTime(req.requestedAt)}</Text>
                  </View>
                  <Badge text={req.status} color={statusColors[req.status] || tone.gray} variant="solid" />
                </View>
                <Text style={styles.itemsSummary}>
                  {req.items.length} item{req.items.length > 1 ? 's' : ''} • Total: {req.items.reduce((s, i) => s + i.quantity, 0)} units
                </Text>
                <View style={styles.historyFooter}>
                  <Badge text={req.urgency} color={urgencyColors[req.urgency]} variant="solid" />
                  {req.cook && <Text style={styles.assignedTo}>Cook: {req.cook.name}</Text>}
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Details Modal */}
      <RequestDetailsModal
        visible={detailsModalVisible}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        cooks={cooks}
      />
    </ScrollView>
  );
}

function RequestCard({ request, onPress }: { request: RefillRequest; onPress: () => void }) {
  const totalItems = request.items.reduce((sum, item) => sum + item.quantity, 0);
  
  return (
    <Pressable style={styles.requestCard} onPress={onPress}>
      <View style={styles.requestHeader}>
        <View>
          <Text style={styles.riderName}>{request.rider.name}</Text>
          {request.assignment?.route && (
            <Text style={styles.routeName}>{request.assignment.route.name}</Text>
          )}
        </View>
        <Badge text={request.urgency} color={urgencyColors[request.urgency]} variant="solid" />
      </View>
      
      <View style={styles.itemsPreview}>
        {request.items.slice(0, 2).map((item, idx) => (
          <Text key={idx} style={styles.itemPreview}>
            {item.name} ({item.quantity})
          </Text>
        ))}
        {request.items.length > 2 && (
          <Text style={styles.moreItems}>+{request.items.length - 2} more</Text>
        )}
      </View>

      <Text style={styles.reasonPreview} numberOfLines={1}>
        {request.reason}
      </Text>

      <View style={styles.requestFooter}>
        <Text style={styles.timeText}>{formatTime(request.requestedAt)}</Text>
        <View style={styles.actionButtons}>
          <Pressable style={styles.smallButton} onPress={onPress}>
            <Text style={styles.smallButtonText}>View Details</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: "#f9fafb" },
  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280" },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: tone.primary,
  },
  tabText: {
    fontWeight: "600",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#fff",
  },

  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  riderName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  routeName: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemsPreview: {
    marginBottom: 6,
  },
  itemPreview: {
    fontSize: 13,
    color: "#374151",
  },
  moreItems: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  reasonPreview: {
    fontSize: 13,
    color: "#4b5563",
    marginBottom: 8,
  },
  requestFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#6b7280",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  emptyState: {
    alignItems: "center",
    padding: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
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

  detailSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f5",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  riderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  subtleText: {
    fontSize: 13,
    color: "#6b7280",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  itemPrice: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  reasonText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  actionSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  cookSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  placeholderText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  notesInput: {
    minHeight: 80,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tone.success,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tone.destructive,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  cancelButtonText: {
    fontWeight: "600",
    color: "#374151",
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  cookItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cookName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  cookEmail: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  historyList: {
    gap: 8,
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  requestTime: {
    fontSize: 11,
    color: "#6b7280",
  },
  itemsSummary: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
  },
  historyFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assignedTo: {
    fontSize: 12,
    color: "#6b7280",
  },

  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  assignedText: {
    fontSize: 13,
    color: "#374151",
  },

  historyItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  historyTime: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 11,
    color: "#374151",
    marginTop: 2,
    fontStyle: "italic",
  },
});