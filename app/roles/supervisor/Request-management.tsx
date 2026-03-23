// app/roles/supervisor/RefillRequests.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  FlatList,
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

type Location = {
  lat: number;
  lng: number;
  address?: string;
  updatedAt?: string;
};

type RefillRequest = {
  _id: string;
  rider: {
    _id: string;
    name: string;
    phone?: string;
  };
  assignment?: {
    _id: string;
    route?: {
      name: string;
    };
    currentLocation?: Location;
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
  
  // Assigned people
  supervisor?: { _id: string; name: string };
  cook?: { _id: string; name: string; phone?: string };
  refillCoordinator?: { _id: string; name: string; phone?: string };
  
  // Notes
  supervisorNotes?: string;
  cookNotes?: string;
  refillNotes?: string;
  
  // Timestamps
  supervisorActionAt?: string;
  cookStartedAt?: string;
  cookCompletedAt?: string;
  refillAssignedAt?: string;
  refillStartedAt?: string;
  deliveredAt?: string;
  
  // Location tracking
  riderLocation?: Location;
  cookLocation?: Location;
  refillLocation?: Location;
  
  // History
  history?: Array<{
    status: string;
    updatedBy: { _id: string; name: string };
    updatedAt: string;
    notes?: string;
  }>;
};

type Cook = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status?: "available" | "busy" | "offline";
  currentTask?: string;
  currentTaskStartTime?: string;
};

type RefillCoordinator = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status?: "available" | "busy" | "offline";
  currentLocation?: Location;
  currentTask?: string;
  currentTaskStartTime?: string;
};

type Team = {
  cooks: Cook[];
  refillCoordinators: RefillCoordinator[];
};

/* ---------- Constants ---------- */
const tone = {
  primary: "#2563eb",
  success: "#059669",
  warning: "#d97706",
  destructive: "#dc2626",
  gray: "#6b7280",
  info: "#0891b2",
  purple: "#9333ea",
  orange: "#ea580c",
};

const statusConfig: Record<string, { label: string; color: string; icon: string; step: number }> = {
  Pending: { label: "Pending", color: tone.warning, icon: "clock", step: 1 },
  Approved: { label: "Approved", color: tone.primary, icon: "check-circle", step: 2 },
  CookPreparing: { label: "Preparing", color: tone.info, icon: "coffee", step: 3 },
  ReadyForPickup: { label: "Ready", color: tone.success, icon: "package", step: 4 },
  AssignedToRefill: { label: "Assigned to Refill", color: tone.purple, icon: "truck", step: 5 },
  OutForDelivery: { label: "Delivering", color: tone.orange, icon: "navigation", step: 6 },
  Delivered: { label: "Delivered", color: tone.success, icon: "check-circle", step: 7 },
  Rejected: { label: "Rejected", color: tone.destructive, icon: "x-circle", step: 0 },
};

const urgencyColors = {
  Low: tone.gray,
  Medium: tone.primary,
  High: tone.warning,
  Critical: tone.destructive,
};

// Default time limits (in minutes)
const DEFAULT_COOK_TIME = 30;
const DEFAULT_REFILL_TIME = 20;

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

function Timer({ startTime, defaultMinutes }: { startTime?: string; defaultMinutes: number }) {
  const [timeElapsed, setTimeElapsed] = useState<string>("00:00");
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      
      const mins = String(diffMins).padStart(2, '0');
      const secs = String(diffSecs).padStart(2, '0');
      setTimeElapsed(`${mins}:${secs}`);
      
      setIsOvertime(diffMins > defaultMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, defaultMinutes]);

  if (!startTime) return null;

  return (
    <View style={[styles.timerContainer, isOvertime && styles.timerOvertime]}>
      <Feather name="clock" size={12} color={isOvertime ? tone.destructive : tone.gray} />
      <Text style={[styles.timerText, isOvertime && styles.timerTextOvertime]}>
        {timeElapsed} / {defaultMinutes}min
      </Text>
    </View>
  );
}

function PersonCard({ 
  person, 
  role, 
  onAssign,
  currentTask,
  startTime,
  defaultTime,
}: { 
  person?: { _id: string; name: string; phone?: string; status?: string };
  role: string;
  onAssign?: () => void;
  currentTask?: string;
  startTime?: string;
  defaultTime?: number;
}) {
  if (!person) {
    return (
      <View style={styles.personCard}>
        <View style={styles.personHeader}>
          <MaterialCommunityIcons 
            name={role === 'cook' ? 'chef-hat' : 'truck'} 
            size={16} 
            color={tone.gray} 
          />
          <Text style={styles.personRole}>{role === 'cook' ? 'Cook' : 'Refill Coordinator'}</Text>
        </View>
        <Text style={styles.notAssignedText}>Not assigned yet</Text>
        {onAssign && (
          <Pressable style={styles.assignButton} onPress={onAssign}>
            <Text style={styles.assignButtonText}>+ Assign</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.personCard, person.status === 'busy' && styles.personCardBusy]}>
      <View style={styles.personHeader}>
        <MaterialCommunityIcons 
          name={role === 'cook' ? 'chef-hat' : 'truck'} 
          size={16} 
          color={person.status === 'busy' ? tone.orange : tone.success} 
        />
        <Text style={styles.personRole}>{role === 'cook' ? 'Cook' : 'Refill'}</Text>
        <View style={[styles.statusDot, { backgroundColor: person.status === 'busy' ? tone.orange : tone.success }]} />
      </View>
      
      <Text style={styles.personName}>{person.name}</Text>
      {person.phone && <Text style={styles.personPhone}>{person.phone}</Text>}
      
      {currentTask && (
        <View style={styles.taskInfo}>
          <Text style={styles.taskLabel}>Current Task:</Text>
          <Text style={styles.taskName}>{currentTask}</Text>
        </View>
      )}
      
      {startTime && defaultTime && (
        <Timer startTime={startTime} defaultMinutes={defaultTime} />
      )}
    </View>
  );
}

function RequestCard({ 
  request, 
  onPress,
  onAssignCook,
  onAssignRefill,
  cooks,
  refillCoordinators,
}: { 
  request: RefillRequest;
  onPress: () => void;
  onAssignCook: (requestId: string) => void;
  onAssignRefill: (requestId: string) => void;
  cooks: Cook[];
  refillCoordinators: RefillCoordinator[];
}) {
  const status = statusConfig[request.status] || statusConfig.Pending;
  const totalItems = request.items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Find assigned people
  const assignedCook = cooks.find(c => c._id === request.cook?._id);
  const assignedRefill = refillCoordinators.find(r => r._id === request.refillCoordinator?._id);

  return (
    <View style={[styles.requestCard, { borderLeftColor: status.color, borderLeftWidth: 4 }]}>
      {/* Header with Rider Info and Urgency */}
      <View style={styles.requestHeader}>
        <View>
          <View style={styles.riderRow}>
            <Feather name="user" size={14} color={tone.primary} />
            <Text style={styles.riderName}>{request.rider.name}</Text>
          </View>
          {request.assignment?.route && (
            <View style={styles.routeRow}>
              <Feather name="map-pin" size={12} color={tone.gray} />
              <Text style={styles.routeName}>{request.assignment.route.name}</Text>
            </View>
          )}
        </View>
        <Badge text={request.urgency} color={urgencyColors[request.urgency]} variant="solid" />
      </View>

      {/* Items Summary */}
      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>
          {request.items.length} Item{request.items.length > 1 ? 's' : ''} • Total: {totalItems} units
        </Text>
        {request.items.slice(0, 2).map((item, idx) => (
          <Text key={idx} style={styles.itemText}>• {item.name} ({item.quantity})</Text>
        ))}
        {request.items.length > 2 && (
          <Text style={styles.moreItems}>+{request.items.length - 2} more items</Text>
        )}
      </View>

      {/* Reason */}
      <Text style={styles.reasonText} numberOfLines={2}>{request.reason}</Text>

      {/* People Cards */}
      <View style={styles.peopleGrid}>
        {/* Cook Section */}
        <PersonCard
          person={assignedCook}
          role="cook"
          onAssign={request.status === "Approved" ? () => onAssignCook(request._id) : undefined}
          currentTask={assignedCook?.currentTask}
          startTime={request.cookStartedAt}
          defaultTime={DEFAULT_COOK_TIME}
        />

        {/* Refill Section */}
        <PersonCard
          person={assignedRefill}
          role="refill"
          onAssign={request.status === "ReadyForPickup" ? () => onAssignRefill(request._id) : undefined}
          currentTask={assignedRefill?.currentTask}
          startTime={request.refillStartedAt}
          defaultTime={DEFAULT_REFILL_TIME}
        />
      </View>

      {/* Status and Time */}
      <View style={styles.footer}>
        <View style={styles.statusRow}>
          <Feather name={status.icon} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.timeText}>{formatTime(request.requestedAt)}</Text>
      </View>

      {/* View Details Button */}
      <Pressable style={styles.detailsButton} onPress={onPress}>
        <Text style={styles.detailsButtonText}>View Details</Text>
        <Feather name="chevron-right" size={14} color={tone.primary} />
      </Pressable>
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function RefillRequestsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<RefillRequest[]>([]);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [refillCoordinators, setRefillCoordinators] = useState<RefillCoordinator[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignType, setAssignType] = useState<'cook' | 'refill'>('cook');
  const [selectedPerson, setSelectedPerson] = useState<Cook | RefillCoordinator | null>(null);

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    try {
      const teamRes = await api.get("/api/supervisor/my-team");
      if (teamRes.ok && teamRes.team) {
        setCooks(teamRes.team.cooks?.map((c: any) => ({ 
          ...c, 
          status: 'available',
          currentTask: undefined,
          currentTaskStartTime: undefined
        })) || []);
        
        setRefillCoordinators(teamRes.team.refillCoordinators?.map((r: any) => ({ 
          ...r, 
          status: 'available',
          currentTask: undefined,
          currentTaskStartTime: undefined
        })) || []);
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    }
  }, []);

  // Fetch all requests
  const fetchAllRequests = useCallback(async () => {
    try {
      const res = await api.get("/api/refill-requests/supervisor/all?limit=100");
      if (res.ok) {
        setRequests(res.requests);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await fetchTeamData();
    await fetchAllRequests();
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Group requests by status
  const groupedRequests = useMemo(() => {
    const grouped = {
      pending: [] as RefillRequest[],
      approved: [] as RefillRequest[],
      preparing: [] as RefillRequest[],
      ready: [] as RefillRequest[],
      delivering: [] as RefillRequest[],
      completed: [] as RefillRequest[],
    };

    requests.forEach(req => {
      if (req.status === "Pending") {
        grouped.pending.push(req);
      } else if (req.status === "Approved") {
        grouped.approved.push(req);
      } else if (req.status === "CookPreparing") {
        grouped.preparing.push(req);
      } else if (req.status === "ReadyForPickup") {
        grouped.ready.push(req);
      } else if (["AssignedToRefill", "OutForDelivery"].includes(req.status)) {
        grouped.delivering.push(req);
      } else if (["Delivered", "Rejected"].includes(req.status)) {
        grouped.completed.push(req);
      }
    });

    // Sort pending by urgency
    grouped.pending.sort((a, b) => {
      const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    return grouped;
  }, [requests]);

  const handleApprove = async (requestId: string, cookId: string) => {
    try {
      const res = await api.patch(`/api/refill-requests/supervisor/${requestId}/approve`, {
        cookId,
        notes: `Assigned to cook`
      });

      if (res.ok) {
        Alert.alert("Success", "Request approved and assigned to cook");
        setAssignModalVisible(false);
        setSelectedPerson(null);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to approve request");
    }
  };

  const handleAssignRefill = async (requestId: string, refillId: string) => {
    try {
      const res = await api.patch(`/api/refill-requests/supervisor/${requestId}/assign-refill`, {
        refillId,
        notes: `Assigned for delivery`
      });

      if (res.ok) {
        Alert.alert("Success", "Refill coordinator assigned");
        setAssignModalVisible(false);
        setSelectedPerson(null);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to assign refill coordinator");
    }
  };

  const openAssignModal = (type: 'cook' | 'refill', request: RefillRequest) => {
    setSelectedRequest(request);
    setAssignType(type);
    setAssignModalVisible(true);
  };

  const getAvailablePeople = () => {
    if (assignType === 'cook') {
      return cooks.filter(c => c.status === 'available');
    } else {
      return refillCoordinators.filter(r => r.status === 'available');
    }
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12 }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Refill Requests</Text>
          <Text style={styles.subtle}>Manage and track all refill requests</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Feather name="refresh-cw" size={18} color={tone.primary} />
        </Pressable>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{groupedRequests.pending.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{groupedRequests.preparing.length}</Text>
          <Text style={styles.statLabel}>Preparing</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{groupedRequests.ready.length}</Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{groupedRequests.delivering.length}</Text>
          <Text style={styles.statLabel}>Delivering</Text>
        </View>
      </View>

      {/* Pending Section */}
      {groupedRequests.pending.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={18} color={tone.warning} />
            <Text style={[styles.sectionTitle, { color: tone.warning }]}>
              Pending Approval ({groupedRequests.pending.length})
            </Text>
          </View>
          {groupedRequests.pending.map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
        </View>
      )}

      {/* Approved Section */}
      {groupedRequests.approved.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="check-circle" size={18} color={tone.primary} />
            <Text style={[styles.sectionTitle, { color: tone.primary }]}>
              Approved - Waiting for Cook ({groupedRequests.approved.length})
            </Text>
          </View>
          {groupedRequests.approved.map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
        </View>
      )}

      {/* Preparing Section */}
      {groupedRequests.preparing.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="chef-hat" size={18} color={tone.info} />
            <Text style={[styles.sectionTitle, { color: tone.info }]}>
              Being Prepared ({groupedRequests.preparing.length})
            </Text>
          </View>
          {groupedRequests.preparing.map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
        </View>
      )}

      {/* Ready for Pickup Section */}
      {groupedRequests.ready.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="package" size={18} color={tone.success} />
            <Text style={[styles.sectionTitle, { color: tone.success }]}>
              Ready for Pickup ({groupedRequests.ready.length})
            </Text>
          </View>
          {groupedRequests.ready.map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
        </View>
      )}

      {/* Delivering Section */}
      {groupedRequests.delivering.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="truck" size={18} color={tone.purple} />
            <Text style={[styles.sectionTitle, { color: tone.purple }]}>
              Out for Delivery ({groupedRequests.delivering.length})
            </Text>
          </View>
          {groupedRequests.delivering.map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
        </View>
      )}

      {/* Completed Section (Collapsed) */}
      {groupedRequests.completed.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="check-circle" size={18} color={tone.success} />
            <Text style={[styles.sectionTitle, { color: tone.success }]}>
              Completed ({groupedRequests.completed.length})
            </Text>
          </View>
          {groupedRequests.completed.slice(0, 3).map(request => (
            <RequestCard
              key={request._id}
              request={request}
              onPress={() => {
                setSelectedRequest(request);
                setDetailsModalVisible(true);
              }}
              onAssignCook={(id) => openAssignModal('cook', request)}
              onAssignRefill={(id) => openAssignModal('refill', request)}
              cooks={cooks}
              refillCoordinators={refillCoordinators}
            />
          ))}
          {groupedRequests.completed.length > 3 && (
            <Pressable style={styles.showMoreButton}>
              <Text style={styles.showMoreText}>+{groupedRequests.completed.length - 3} more completed</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Assignment Modal */}
      <Modal transparent visible={assignModalVisible} animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setAssignModalVisible(false)} />
        <View style={styles.assignModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Assign {assignType === 'cook' ? 'Cook' : 'Refill Coordinator'}
            </Text>
            <Pressable onPress={() => setAssignModalVisible(false)}>
              <Feather name="x" size={22} color={tone.gray} />
            </Pressable>
          </View>

          <Text style={styles.modalSubtitle}>
            Select available {assignType === 'cook' ? 'cook' : 'refill coordinator'}:
          </Text>

          <ScrollView style={styles.peopleList}>
            {getAvailablePeople().map(person => (
              <Pressable
                key={person._id}
                style={styles.personOption}
                onPress={() => setSelectedPerson(person)}
              >
                <View style={styles.personOptionInfo}>
                  <Text style={styles.personOptionName}>{person.name}</Text>
                  {person.phone && <Text style={styles.personOptionPhone}>{person.phone}</Text>}
                </View>
                {selectedPerson?._id === person._id && (
                  <Feather name="check-circle" size={20} color={tone.success} />
                )}
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.confirmButton, !selectedPerson && styles.disabledButton]}
              onPress={() => {
                if (selectedPerson && selectedRequest) {
                  if (assignType === 'cook') {
                    handleApprove(selectedRequest._id, selectedPerson._id);
                  } else {
                    handleAssignRefill(selectedRequest._id, selectedPerson._id);
                  }
                }
              }}
              disabled={!selectedPerson}
            >
              <Text style={styles.confirmButtonText}>Confirm Assignment</Text>
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setAssignModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Details Modal (keep for detailed view) */}
      <Modal transparent visible={detailsModalVisible} animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailsModalVisible(false)} />
        <View style={styles.detailsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <Pressable onPress={() => setDetailsModalVisible(false)}>
              <Feather name="x" size={22} color={tone.gray} />
            </Pressable>
          </View>
          
          {selectedRequest && (
            <ScrollView>
              <Text style={styles.detailSectionTitle}>Rider Information</Text>
              <View style={styles.detailCard}>
                <Text style={styles.detailText}>Name: {selectedRequest.rider.name}</Text>
                {selectedRequest.rider.phone && (
                  <Text style={styles.detailText}>Phone: {selectedRequest.rider.phone}</Text>
                )}
                {selectedRequest.assignment?.route && (
                  <Text style={styles.detailText}>Route: {selectedRequest.assignment.route.name}</Text>
                )}
              </View>

              <Text style={styles.detailSectionTitle}>Items Requested</Text>
              <View style={styles.detailCard}>
                {selectedRequest.items.map((item, idx) => (
                  <View key={idx} style={styles.detailItemRow}>
                    <Text style={styles.detailItemName}>{item.name}</Text>
                    <Text style={styles.detailItemQuantity}>x{item.quantity}</Text>
                    <Text style={styles.detailItemPrice}>₹{item.price * item.quantity}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.detailSectionTitle}>Reason</Text>
              <View style={styles.detailCard}>
                <Text style={styles.detailReason}>{selectedRequest.reason}</Text>
              </View>

              <Text style={styles.detailSectionTitle}>Status History</Text>
              <View style={styles.detailCard}>
                {selectedRequest.history?.map((event, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <Badge text={event.status} color={statusConfig[event.status]?.color || tone.gray} variant="solid" />
                    <Text style={styles.historyTime}>{new Date(event.updatedAt).toLocaleString()}</Text>
                    {event.notes && <Text style={styles.historyNotes}>{event.notes}</Text>}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function formatTime(dateString?: string) {
  if (!dateString) return "";
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280" },
  refreshButton: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eceff3",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
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
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  riderName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  routeName: {
    fontSize: 12,
    color: "#6b7280",
  },

  itemsContainer: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  itemText: {
    fontSize: 12,
    color: "#4b5563",
    marginLeft: 4,
  },
  moreItems: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    fontStyle: "italic",
  },

  reasonText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },

  peopleGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },

  personCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  personCardBusy: {
    borderColor: tone.orange,
    backgroundColor: "#fff7ed",
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  personRole: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    flex: 1,
  },
  personName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  personPhone: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  notAssignedText: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 4,
  },
  assignButton: {
    backgroundColor: tone.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  assignButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  taskInfo: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  taskLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  taskName: {
    fontSize: 11,
    color: "#111827",
    fontWeight: "500",
  },

  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  timerOvertime: {
    borderTopColor: tone.destructive,
  },
  timerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  timerTextOvertime: {
    color: tone.destructive,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 11,
    color: "#6b7280",
  },

  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef1f5",
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: tone.primary,
  },

  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  showMoreButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: 13,
    color: tone.primary,
    fontWeight: "600",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },

  assignModal: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "20%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "60%",
  },
  detailsModal: {
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
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },

  peopleList: {
    maxHeight: 300,
  },
  personOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  personOptionInfo: {
    flex: 1,
  },
  personOptionName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  personOptionPhone: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: tone.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },

  detailSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
  },
  detailCard: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  detailItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  detailItemName: {
    flex: 2,
    fontSize: 13,
    color: "#111827",
  },
  detailItemQuantity: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  detailItemPrice: {
    flex: 1,
    fontSize: 13,
    color: tone.success,
    fontWeight: "600",
    textAlign: "right",
  },
  detailReason: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
  },
  historyItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  historyTime: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 12,
    color: "#374151",
    marginTop: 2,
  },
});