import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';

/* ---------- Types ---------- */
type FoodItem = {
  _id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
};

type InventoryItem = {
  foodItem: FoodItem;
  quantityAssigned: number;
  quantityRemaining: number;
  quantitySold: number;
  name?: string;
  price?: number;
};

type RouteStop = {
  _id: string;
  stopName: string;
  address?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  arrivedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  sales?: {
    items: Array<{
      foodItemId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    totalRevenue: number;
    totalItems: number;
  };
};

type Vehicle = {
  _id: string;
  registrationNo: string;
  type: string;
};

type Battery = {
  _id: string;
  imei: string;
  charge: number;
  health: number;
};

type Assignment = {
  _id: string;
  route: {
    _id: string;
    name: string;
  };
  stops: RouteStop[];
  vehicle: Vehicle;
  battery: Battery;
  inventory: InventoryItem[];
  startTime?: string;
  endTime?: string;
  status: 'pending' | 'active' | 'completed';
  date: string;
  createdAt: string;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
};

type CompletedAssignment = {
  _id: string;
  route: {
    _id: string;
    name: string;
  };
  status: 'completed';
  date: string;
  startTime?: string;
  endTime?: string;
  totalSales?: number;
  totalItemsSold?: number;
  inventory?: Array<{
    foodItem: FoodItem;
    quantityAssigned: number;
    quantityRemaining: number;
    quantitySold: number;
  }>;
};

type ApiResponse = {
  ok: boolean;
  assignment?: Assignment;
  message?: string;
  error?: string;
};

/* ---------- Constants ---------- */
const tone = {
  success: '#059669',
  primary: '#2563eb',
  warning: '#d97706',
  destructive: '#dc2626',
  gray: '#6b7280',
  info: '#0891b2',
};

/* ---------- Components ---------- */
function Badge({ text, color, solid }: { text: string; color: string; solid: boolean }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: solid ? color : 'transparent', borderColor: color },
      ]}
    >
      <Text style={{ color: solid ? '#fff' : color, fontSize: 11, fontWeight: '700' }}>
        {text}
      </Text>
    </View>
  );
}

function ProgressBar({ value, color = tone.primary }: { value: number; color?: string }) {
  const safeValue = Math.min(Math.max(value || 0, 0), 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${safeValue}%`, backgroundColor: color }]} />
    </View>
  );
}

// Accept Assignment Modal
function AcceptAssignmentModal({
  visible,
  onClose,
  onAccept,
  assignment,
  loading
}: {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  assignment: Assignment | null;
  loading: boolean;
}) {
  if (!assignment) return null;

  const totalItems = assignment.inventory?.reduce((sum, item) => sum + (item.quantityAssigned || 0), 0) || 0;
  const totalStops = assignment.stops?.length || 0;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.acceptModalCard}>
          <View style={styles.acceptModalHeader}>
            <View style={styles.acceptIconContainer}>
              <Feather name="map" size={32} color={tone.primary} />
            </View>
            <Text style={styles.acceptModalTitle}>Accept Assignment</Text>
            <Text style={styles.acceptModalSubtitle}>
              You have been assigned a new route
            </Text>
          </View>

          <View style={styles.acceptModalDetails}>
            <View style={styles.detailRow}>
              <Feather name="navigation" size={18} color={tone.gray} />
              <Text style={styles.detailText}>
                Route: <Text style={styles.detailValue}>{assignment.route?.name || 'Unknown Route'}</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Feather name="truck" size={18} color={tone.gray} />
              <Text style={styles.detailText}>
                Vehicle: <Text style={styles.detailValue}>{assignment.vehicle?.registrationNo || 'Not Assigned'}</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="battery" size={18} color={tone.gray} />
              <Text style={styles.detailText}>
                Battery: <Text style={styles.detailValue}>{assignment.battery?.charge || 0}%</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Feather name="package" size={18} color={tone.gray} />
              <Text style={styles.detailText}>
                Items: <Text style={styles.detailValue}>{totalItems} items</Text>
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Feather name="map-pin" size={18} color={tone.gray} />
              <Text style={styles.detailText}>
                Stops: <Text style={styles.detailValue}>{totalStops} locations</Text>
              </Text>
            </View>
          </View>

          <View style={styles.acceptModalActions}>
            <Pressable
              style={[styles.acceptBtn, loading && styles.disabledBtn]}
              onPress={onAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept Assignment</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.rejectBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </Pressable>
          </View>

          <Text style={styles.acceptModalNote}>
            You have 5 minutes to accept this assignment
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Stop Sale Modal
function StopSaleModal({
  visible,
  onClose,
  stop,
  inventory = [],
  assignmentId,
  onSaleRecorded
}: {
  visible: boolean;
  onClose: () => void;
  stop: RouteStop | null;
  inventory: InventoryItem[];
  assignmentId: string;
  onSaleRecorded: () => void;
}) {
  const [sales, setSales] = useState<Array<{ foodItemId: string; quantity: string }>>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible && inventory?.length > 0) {
      setSales(inventory.map(item => ({
        foodItemId: item.foodItem?._id || '',
        quantity: '0'
      })));
    }
  }, [visible, inventory]);

  const updateQuantity = (foodItemId: string, value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');
    setSales(prev => prev.map(s =>
      s.foodItemId === foodItemId ? { ...s, quantity: numericValue } : s
    ));
  };

  const handleSubmit = async () => {
    if (!stop) return;

    const salesData = sales
      .map(s => ({
        foodItemId: s.foodItemId,
        quantity: parseInt(s.quantity) || 0
      }))
      .filter(s => s.quantity > 0);

    if (salesData.length === 0) {
      Alert.alert('Error', 'Please enter at least one sale');
      return;
    }

    for (const sale of salesData) {
      const inventoryItem = inventory.find(i => i.foodItem?._id === sale.foodItemId);
      if (inventoryItem && sale.quantity > (inventoryItem.quantityRemaining || 0)) {
        Alert.alert(
          'Error',
          `Cannot sell ${sale.quantity} ${inventoryItem.foodItem?.name || 'item'}. Only ${inventoryItem.quantityRemaining} remaining.`
        );
        return;
      }
    }

    setLoading(true);
    try {
      for (const sale of salesData) {
        await api.post('/api/rider/sales', {
          assignmentId,
          foodItemId: sale.foodItemId,
          qty: sale.quantity,
          stopId: stop._id
        });
      }

      Alert.alert('Success', 'Sales recorded successfully');
      onSaleRecorded();
      onClose();
    } catch (error: any) {
      console.error('Sales error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to record sales');
    } finally {
      setLoading(false);
    }
  };

  if (!stop) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Record Sales at {stop.stopName}</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={tone.gray} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 400 }}>
          {inventory?.length > 0 ? (
            inventory.map(item => {
              const sale = sales.find(s => s.foodItemId === item.foodItem?._id);
              return (
                <View key={item.foodItem?._id || Math.random().toString()} style={styles.saleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{item.foodItem?.name || 'Unknown'}</Text>
                    <Text style={styles.subtleSmall}>
                      Price: ₹{item.foodItem?.price || 0} • Remaining: {item.quantityRemaining || 0}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.saleInput}
                    placeholder="0"
                    keyboardType="number-pad"
                    value={sale?.quantity}
                    onChangeText={(val) => updateQuantity(item.foodItem?._id || '', val)}
                  />
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No inventory items available</Text>
          )}
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Record Sales</Text>}
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onClose}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Completion Summary Modal
function CompletionSummaryModal({
  visible,
  onClose,
  assignment
}: {
  visible: boolean;
  onClose: () => void;
  assignment: Assignment | null;
}) {
  if (!assignment) return null;

  const totalStops = assignment.stops?.length || 0;
  const completedStops = assignment.stops?.filter(s => s.status === 'completed').length || 0;
  const totalItemsSold = assignment.inventory?.reduce((sum, i) => sum + (i.quantitySold || 0), 0) || 0;
  const totalRevenue = assignment.inventory?.reduce(
    (sum, i) => sum + ((i.quantitySold || 0) * (i.foodItem?.price || 0)), 0
  ) || 0;

  const totalDuration = assignment.startTime && assignment.endTime
    ? Math.round((new Date(assignment.endTime).getTime() - new Date(assignment.startTime).getTime()) / 60000)
    : 0;

  const averageStopTime = completedStops > 0
    ? Math.round(totalDuration / completedStops)
    : 0;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.completionModalCard}>
          <View style={styles.completionHeader}>
            <View style={styles.successIconContainer}>
              <Feather name="check-circle" size={48} color={tone.success} />
            </View>
            <Text style={styles.completionTitle}>Route Completed! 🎉</Text>
            <Text style={styles.completionSubtitle}>
              Great job! You've finished your route
            </Text>
          </View>

          <View style={styles.completionStats}>
            <View style={styles.completionStatItem}>
              <Text style={styles.completionStatValue}>{completedStops}/{totalStops}</Text>
              <Text style={styles.completionStatLabel}>Stops Completed</Text>
            </View>
            <View style={styles.completionStatItem}>
              <Text style={styles.completionStatValue}>{totalItemsSold}</Text>
              <Text style={styles.completionStatLabel}>Items Sold</Text>
            </View>
            <View style={styles.completionStatItem}>
              <Text style={[styles.completionStatValue, { color: tone.success }]}>
                ₹{totalRevenue.toFixed(2)}
              </Text>
              <Text style={styles.completionStatLabel}>Total Revenue</Text>
            </View>
          </View>

          <View style={styles.completionDetails}>
            <View style={styles.completionDetailRow}>
              <Feather name="clock" size={16} color={tone.gray} />
              <Text style={styles.completionDetailText}>
                Total Time: <Text style={styles.completionDetailValue}>{totalDuration} minutes</Text>
              </Text>
            </View>
            <View style={styles.completionDetailRow}>
              <Feather name="bar-chart-2" size={16} color={tone.gray} />
              <Text style={styles.completionDetailText}>
                Avg per Stop: <Text style={styles.completionDetailValue}>{averageStopTime} minutes</Text>
              </Text>
            </View>
            <View style={styles.completionDetailRow}>
              <Feather name="shopping-bag" size={16} color={tone.gray} />
              <Text style={styles.completionDetailText}>
                Items per Stop: <Text style={styles.completionDetailValue}>{(totalItemsSold / Math.max(completedStops, 1)).toFixed(1)}</Text>
              </Text>
            </View>
          </View>

          <Pressable style={styles.completionBtn} onPress={onClose}>
            <Text style={styles.completionBtnText}>View Summary</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Previous Routes Component
function PreviousRoutesSection({ 
  assignments, 
  loading, 
  onViewSummary 
}: { 
  assignments: CompletedAssignment[]; 
  loading: boolean;
  onViewSummary: (assignmentId: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={tone.primary} />
        <Text style={styles.subtle}>Loading history...</Text>
      </View>
    );
  }

  if (assignments.length === 0) {
    return (
      <View style={styles.card}>
        <Feather name="calendar" size={24} color={tone.gray} />
        <Text style={styles.subtle}>No completed routes yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>📋 Previous Routes</Text>
      <Text style={styles.subtle}>Your completed deliveries</Text>
      
      {assignments.map((assignment, idx) => (
        <View key={assignment._id} style={[styles.historyItem, idx > 0 && styles.historyItemBorder]}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.historyRouteName}>{assignment.route?.name || 'Unknown Route'}</Text>
              <Text style={styles.historyDate}>
                {new Date(assignment.date).toLocaleDateString()}
              </Text>
            </View>
            <Badge text="Completed" color={tone.success} solid />
          </View>
          
          <View style={styles.historyStats}>
            <View style={styles.historyStat}>
              <Feather name="package" size={14} color={tone.gray} />
              <Text style={styles.historyStatText}>
                {assignment.totalItemsSold || 0} items sold
              </Text>
            </View>
            <View style={styles.historyStat}>
              <Feather name="rupee" size={14} color={tone.success} />
              <Text style={[styles.historyStatText, { color: tone.success }]}>
                ₹{(assignment.totalSales || 0).toFixed(2)}
              </Text>
            </View>
          </View>
          
          <Pressable
            style={styles.viewSummaryBtn}
            onPress={() => onViewSummary(assignment._id)}
          >
            <Text style={styles.viewSummaryBtnText}>View Summary →</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// Summary Modal Component
function AssignmentSummaryModal({
  visible,
  onClose,
  assignmentId,
}: {
  visible: boolean;
  onClose: () => void;
  assignmentId: string | null;
}) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && assignmentId) {
      fetchSummary();
    }
  }, [visible, assignmentId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/rider/assignments/${assignmentId}/summary`);
      if (response.ok && response.summary) {
        setSummary(response.summary);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      Alert.alert('Error', 'Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.summaryModalCard}>
            <ActivityIndicator size="large" color={tone.primary} />
          </View>
        </View>
      </Modal>
    );
  }

  if (!summary) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.summaryModalCard}>
          <View style={styles.summaryModalHeader}>
            <Text style={styles.summaryModalTitle}>{summary.routeName}</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={tone.gray} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: '80%' }}>
            <View style={styles.summaryStatsGrid}>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryStatValue}>{summary.totalStops}</Text>
                <Text style={styles.summaryStatLabel}>Total Stops</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryStatValue}>{summary.stopsWithSales}</Text>
                <Text style={styles.summaryStatLabel}>Stops with Sales</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryStatValue}>{summary.totalItemsSold}</Text>
                <Text style={styles.summaryStatLabel}>Items Sold</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={[styles.summaryStatValue, { color: tone.success }]}>
                  ₹{summary.totalRevenue.toFixed(2)}
                </Text>
                <Text style={styles.summaryStatLabel}>Total Revenue</Text>
              </View>
            </View>

            <View style={styles.summaryTimeInfo}>
              <View style={styles.summaryTimeRow}>
                <Feather name="clock" size={16} color={tone.gray} />
                <Text style={styles.summaryTimeText}>
                  Started: {summary.startTime ? new Date(summary.startTime).toLocaleTimeString() : 'N/A'}
                </Text>
              </View>
              <View style={styles.summaryTimeRow}>
                <Feather name="check-circle" size={16} color={tone.success} />
                <Text style={styles.summaryTimeText}>
                  Completed: {summary.endTime ? new Date(summary.endTime).toLocaleTimeString() : 'N/A'}
                </Text>
              </View>
              <View style={styles.summaryTimeRow}>
                <Feather name="hourglass" size={16} color={tone.warning} />
                <Text style={styles.summaryTimeText}>
                  Total Duration: {summary.totalDuration} minutes
                </Text>
              </View>
            </View>

            <Text style={styles.summarySectionTitle}>Items Sold</Text>
            {summary.inventory?.map((item: any, idx: number) => (
              item.sold > 0 && (
                <View key={idx} style={styles.summaryInventoryItem}>
                  <View>
                    <Text style={styles.summaryItemName}>{item.name}</Text>
                    <Text style={styles.summaryItemQty}>Sold: {item.sold} units</Text>
                  </View>
                  <Text style={styles.summaryItemRevenue}>₹{item.revenue}</Text>
                </View>
              )
            ))}

            <Text style={styles.summarySectionTitle}>Stop Details</Text>
            {summary.stops?.map((stop: any, idx: number) => (
              <View key={idx} style={styles.summaryStopItem}>
                <View style={styles.summaryStopHeader}>
                  <Text style={styles.summaryStopName}>Stop {idx + 1}: {stop.name}</Text>
                  <Badge text={stop.status} color={stop.status === 'completed' ? tone.success : tone.gray} solid={false} />
                </View>
                {stop.itemsSold > 0 && (
                  <View style={styles.summaryStopSales}>
                    <Text style={styles.subtleSmall}>Items: {stop.itemsSold}</Text>
                    <Text style={[styles.subtleSmall, { color: tone.success }]}>
                      Revenue: ₹{stop.revenue}
                    </Text>
                  </View>
                )}
                {stop.durationMinutes > 0 && (
                  <Text style={styles.subtleSmall}>Time spent: {stop.durationMinutes} min</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.closeSummaryBtn} onPress={onClose}>
            <Text style={styles.closeSummaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function MyRouteScreen() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [completedAssignments, setCompletedAssignments] = useState<CompletedAssignment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      setError(null);
      console.log("Fetching assignment for today...");
      const response = await api.get<ApiResponse>('/api/rider/assignments/today');

      console.log("Full Response:", JSON.stringify(response, null, 2));

      if (response.ok && response.assignment) {
        setAssignment(response.assignment);
        console.log("=== ASSIGNMENT STATE ===");
        console.log("Status:", response.assignment.status);
        console.log("StartTime:", response.assignment.startTime);
        console.log("Has StartTime:", !!response.assignment.startTime);
        console.log("Should show Start Button:", response.assignment.status === 'active' && !response.assignment.startTime);
        console.log("=======================");

        if (response.assignment.status === 'pending') {
          console.log("Showing accept modal");
          setAcceptModalVisible(true);
        } else {
          setAcceptModalVisible(false);
        }
      } else {
        console.log("No assignment found");
        setAssignment(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch assignment:', err);
      setError(err?.message || 'Failed to load assignment');
      setAssignment(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchCompletedAssignments = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const response = await api.get('/api/rider/assignments/completed');
      
      if (response.ok && response.assignments) {
        setCompletedAssignments(response.assignments);
        console.log(`Loaded ${response.assignments.length} completed assignments`);
      }
    } catch (err: any) {
      console.error('Failed to fetch completed assignments:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignment();
    fetchCompletedAssignments();
  }, [fetchAssignment, fetchCompletedAssignments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssignment();
    fetchCompletedAssignments();
  }, [fetchAssignment, fetchCompletedAssignments]);

  const handleAcceptAssignment = async () => {
    if (!assignment?._id) return;

    setAcceptLoading(true);
    try {
      console.log("Accepting assignment:", assignment._id);
      const res = await api.post(`/api/rider/assignments/${assignment._id}/accept`);

      console.log("Accept response:", res);

      if (res.ok) {
        setAcceptModalVisible(false);
        await fetchAssignment();
        Alert.alert('Success', 'Assignment accepted! Click "Start Route" to begin.');
      } else {
        Alert.alert('Error', res.message || res.error || 'Failed to accept assignment');
      }
    } catch (error: any) {
      console.error('Accept assignment error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message || 'Failed to accept assignment');
    } finally {
      setAcceptLoading(false);
    }
  };



  const forceStartRoute = async () => {
    if (!assignment?._id) return;

    try {
      setSaving(true);
      console.log("FORCE starting assignment:", assignment._id);
      const res = await api.post(`/api/rider/assignments/${assignment._id}/start`, {});
      console.log("Force start response:", res);
      if (res.ok) {
        await fetchAssignment();
        Alert.alert('Success', 'Route started!');
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to start');
      }
    } catch (error: any) {
      console.error('Force start error:', error);
      Alert.alert('Error', error?.response?.data?.error || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const resetStuckStop = async (stopId: string, stopName: string) => {
    if (!assignment?._id) return;

    Alert.alert(
      "Reset Stop",
      `Are you sure you want to reset "${stopName}" to pending? This will allow you to arrive again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.post(`/api/rider/debug/reset-stop/${assignment._id}/${stopId}`);
              if (response.success) {
                Alert.alert("Success", `Stop "${stopName}" has been reset`);
                await fetchAssignment();
              } else {
                Alert.alert("Error", response.error || "Failed to reset stop");
              }
            } catch (error: any) {
              console.error("Reset error:", error);
              Alert.alert("Error", error?.response?.data?.error || error?.message || "Failed to reset stop");
            }
          }
        }
      ]
    );
  };

  const handleArriveAtStop = async (stopId: string) => {
    if (!assignment?._id) return;

    try {
      setSaving(true);
      console.log("Arriving at stop:", stopId);
      console.log("Assignment ID:", assignment._id);

      const res = await api.post(`/api/rider/assignments/${assignment._id}/stops/${stopId}/arrive`, {});

      console.log("Arrive response:", res);

      if (res.ok) {
        await fetchAssignment();
        Alert.alert('Success', `Arrived at stop! You can now record sales.`);
      } else {
        Alert.alert('Error', res.data?.error || res.message || 'Failed to mark arrival');
      }
    } catch (error: any) {
      console.error('Arrive error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to mark arrival';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const testCompleteStop = async (stopId: string, stopName: string) => {
    if (!assignment?._id) return;

    try {
      console.log(`Testing complete stop: ${stopName} (${stopId})`);
      const response = await api.post(`/api/rider/assignments/${assignment._id}/stops/${stopId}/complete`);
      console.log("Complete response:", response);

      if (response.ok) {
        Alert.alert("Success", `${stopName} completed!`);
        await fetchAssignment();
      } else {
        Alert.alert("Error", response.data?.error || response.message || "Failed to complete stop");
      }
    } catch (error: any) {
      console.error("Complete stop error:", error);
      Alert.alert("Error", error?.response?.data?.error || error?.message || "Failed to complete stop");
    }
  };


  const handleViewSummary = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setSummaryModalVisible(true);
  };

  const completedStops = assignment?.stops?.filter(s => s?.status === 'completed')?.length || 0;
  const inProgressStop = assignment?.stops?.find(s => s?.status === 'in-progress');
  const totalStops = assignment?.stops?.length || 0;
  const progressPct = totalStops > 0
    ? ((completedStops + (inProgressStop ? 0.5 : 0)) / totalStops) * 100
    : 0;

  const totalSold = assignment?.inventory?.reduce((sum, item) => sum + (item?.quantitySold || 0), 0) || 0;
  const totalAssigned = assignment?.inventory?.reduce((sum, item) => sum + (item?.quantityAssigned || 0), 0) || 0;
  const totalRemaining = assignment?.inventory?.reduce((sum, item) => sum + (item?.quantityRemaining || 0), 0) || 0;
  const totalRevenue = assignment?.inventory?.reduce(
    (sum, item) => sum + ((item?.quantitySold || 0) * (item?.foodItem?.price || 0)), 0
  ) || 0;

  const formatTime = (dateString?: string) => {
    if (!dateString) return '--:--';
    try {
      return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };



  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12, color: tone.gray }}>Loading your route...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        contentContainerStyle={[styles.page, { flex: 1, justifyContent: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={60} color={tone.destructive} />
          <Text style={styles.h1}>Error Loading Route</Text>
          <Text style={styles.subtle}>{error}</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={onRefresh}>
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!assignment) {
    return (
      <ScrollView
        contentContainerStyle={[styles.page, { flex: 1, justifyContent: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyState}>
          <Feather name="map" size={60} color={tone.gray} />
          <Text style={styles.h1}>No Active Route</Text>
          <Text style={styles.subtle}>You don't have any active assignments for today.</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={onRefresh}>
            <Text style={styles.primaryBtnText}>Refresh</Text>
          </Pressable>
        </View>
        
        {/* Show previous routes even when no active route */}
        <PreviousRoutesSection 
          assignments={completedAssignments}
          loading={loadingHistory}
          onViewSummary={handleViewSummary}
        />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View>
          <Text style={styles.h1}>My Route</Text>
          <Text style={styles.subtle}>
            {assignment.date ? new Date(assignment.date).toLocaleDateString() : 'Today'} • {assignment.route?.name || 'Unknown Route'}
          </Text>
        </View>

     

        {/* Map Image */}
        <View style={styles.mapWrap}>
          <Image
            source={require('../../../assets/map.png')}
            style={styles.mapImage}
            resizeMode='cover'
          />
        </View>

        {/* Route Card */}
        <View style={styles.card}>
          <View style={[styles.rowBetween, { marginBottom: 8 }]}>
            <View>
              <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                <Feather name='map-pin' size={18} color={tone.primary} />
                <Text style={styles.sectionTitle}>{assignment.route?.name || 'Route'}</Text>
              </View>
              <Text style={styles.subtleSmall}>
                {assignment.startTime ? formatTime(assignment.startTime) : 'Not started'} •
                {inProgressStop ? ` Current: ${inProgressStop.stopName || 'Stop'}` : ` ${completedStops}/${totalStops} stops`}
              </Text>
            </View>
            <Badge
              text={assignment.status === 'active' ? 'Active' : assignment.status === 'pending' ? 'Pending' : 'Completed'}
              color={assignment.status === 'active' ? tone.success : assignment.status === 'pending' ? tone.warning : tone.gray}
              solid
            />
          </View>

          <View>
            <View style={[styles.rowBetween, { marginBottom: 6 }]}>
              <Text style={styles.subtleSmall}>Route Progress</Text>
              <Text style={styles.subtleSmall}>
                {completedStops}/{totalStops} stops • {totalAssigned > 0 ? Math.round((totalSold / totalAssigned) * 100) : 0}% sold
              </Text>
            </View>
            <ProgressBar value={progressPct} />
          </View>

          {/* Status Indicator */}
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, {
              backgroundColor: assignment.status === 'pending' ? tone.warning :
                !assignment.startTime ? tone.warning :
                  assignment.status === 'completed' ? tone.success : tone.primary
            }]} />
            <Text style={styles.statusText}>
              {assignment.status === 'pending' ? 'Awaiting Acceptance' :
                !assignment.startTime ? 'Ready to Start' :
                  assignment.status === 'completed' ? 'Completed' :
                    'In Progress'}
            </Text>
          </View>

          {(assignment.vehicle || assignment.battery) && (
            <View style={styles.vehicleInfo}>
              {assignment.vehicle && (
                <View style={styles.infoChip}>
                  <Feather name="truck" size={14} color={tone.gray} />
                  <Text style={styles.infoText}>{assignment.vehicle.registrationNo || 'No vehicle'}</Text>
                </View>
              )}
              {assignment.battery && (
                <View style={styles.infoChip}>
                  <MaterialCommunityIcons name="battery" size={14} color={tone.gray} />
                  <Text style={styles.infoText}>{assignment.battery.charge || 0}%</Text>
                </View>
              )}
            </View>
          )}

          {/* Accept Button */}
          {assignment.status === 'pending' && (
            <Pressable
              style={[styles.primaryBtn, { marginTop: 12, backgroundColor: tone.success }]}
              onPress={handleAcceptAssignment}
              disabled={acceptLoading}
            >
              {acceptLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="check-circle" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Accept Assignment</Text>
                </>
              )}
            </Pressable>
          )}

     
      

        {/* Start Route Button - Only show if not started */}
{assignment.status === 'active' && !assignment.startTime && (
  <Pressable
    style={[styles.primaryBtn, { marginTop: 12, backgroundColor: tone.success }]}
    onPress={forceStartRoute}
    disabled={saving}
  >
    <Feather name="play" size={16} color="#fff" />
    <Text style={styles.primaryBtnText}>Start Route</Text>
  </Pressable>
)}

{/* Show message if route is already started */}
{assignment.status === 'active' && assignment.startTime && (
  <View style={[styles.infoChip, { marginTop: 12, justifyContent: 'center', backgroundColor: '#e6f0ff' }]}>
    <Feather name="check-circle" size={14} color={tone.success} />
    <Text style={[styles.infoText, { color: tone.success, fontWeight: '600' }]}>
      Route Started at {formatTime(assignment.startTime)}
    </Text>
  </View>
)}
        </View>

        {/* Inventory Summary Card */}
        {assignment.inventory && assignment.inventory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My Inventory</Text>
            <Text style={styles.subtle}>Items assigned to you</Text>

            <View style={styles.inventoryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statBig}>{totalAssigned}</Text>
                <Text style={styles.statLabel}>Assigned</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statBig, { color: tone.success }]}>{totalSold}</Text>
                <Text style={styles.statLabel}>Sold</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statBig, { color: tone.warning }]}>{totalRemaining}</Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
            </View>

            <View style={styles.listWrap}>
              {assignment.inventory.map((item, idx) => {
                const soldPercent = item.quantityAssigned > 0
                  ? (item.quantitySold / item.quantityAssigned) * 100
                  : 0;
                return (
                  <View key={item.foodItem?._id || idx}>
                    <View style={styles.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listLeft}>{item.foodItem?.name || 'Unknown'}</Text>
                        <Text style={styles.subtleSmall}>Price: ₹{item.foodItem?.price || 0}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.rightTop}>Sold: {item.quantitySold || 0}</Text>
                        <Text style={styles.subtleSmall}>Left: {item.quantityRemaining || 0}</Text>
                      </View>
                    </View>
                    <View style={styles.progressContainer}>
                      <ProgressBar value={soldPercent} color={tone.success} />
                      <Text style={styles.progressText}>{Math.round(soldPercent)}% sold</Text>
                    </View>
                    {idx < assignment.inventory.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Route Stops */}
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionTitle}>Route Stops</Text>
          {assignment.stops && assignment.stops.length > 0 ? (
            assignment.stops.map((stop, index) => {
              const isCompleted = stop?.status === 'completed';
              const isInProgress = stop?.status === 'in-progress';
              const isPending = stop?.status === 'pending';
              const isStuck = stop?.status === 'in-progress' && !assignment.startTime;

              const isNextStop = isPending && index === completedStops && !inProgressStop && !!assignment.startTime;

              return (
                <View
                  key={stop?._id || index}
                  style={[
                    styles.card,
                    isInProgress && styles.currentStopCard,
                  ]}
                >
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.row, { alignItems: 'center', gap: 8, flexWrap: 'wrap' }]}>
                        <Text style={styles.stopName}>
                          {`${index + 1}. ${stop?.stopName || 'Unknown Stop'}`}
                        </Text>
                        {isInProgress && <Badge text="In Progress" color={tone.primary} solid />}
                        {isCompleted && <Badge text="Completed" color={tone.success} solid />}
                        {isPending && !isInProgress && <Badge text="Pending" color={tone.gray} solid={false} />}
                      </View>
                      {stop?.address ? <Text style={styles.subtleSmall}>{stop.address}</Text> : null}
                    </View>
                  </View>

                  {stop?.arrivedAt && (
                    <View style={styles.stopTime}>
                      <Feather name="clock" size={14} color={tone.gray} />
                      <Text style={styles.subtleSmall}> Arrived: {formatTime(stop.arrivedAt)}</Text>
                    </View>
                  )}

                  {stop?.completedAt && (
                    <View style={styles.stopTime}>
                      <Feather name="check-circle" size={14} color={tone.success} />
                      <Text style={styles.subtleSmall}> Completed: {formatTime(stop.completedAt)}</Text>
                      {stop.durationMinutes ? (
                        <Text style={styles.subtleSmall}> • {stop.durationMinutes} min</Text>
                      ) : null}
                    </View>
                  )}

                  {stop?.sales && stop.sales.totalItems > 0 && (
                    <View style={styles.stopSales}>
                      <Text style={styles.subtleSmall}>Sales at this stop:</Text>
                      <View style={styles.stopSalesGrid}>
                        <View style={styles.stopSalesItem}>
                          <Text style={styles.statValue}>{stop.sales.totalItems} items</Text>
                        </View>
                        <View style={styles.stopSalesItem}>
                          <Text style={[styles.statValue, { color: tone.success }]}>
                            ₹{stop.sales.totalRevenue?.toFixed(2) || '0.00'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {isInProgress && !isCompleted && (
                    <>
                      <View style={styles.stopActions}>
                        <Pressable
                          style={[styles.primaryBtn, { flex: 1 }]}
                          onPress={() => {
                            setSelectedStop(stop);
                            setSaleModalVisible(true);
                          }}
                        >
                          <Feather name="shopping-bag" size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Record Sales</Text>
                        </Pressable>
                        <Pressable
                        style={[styles.successBtn, { flex: 1 }]}
                        onPress={() => testCompleteStop(stop._id, stop.stopName)}
                      >
                        <Feather name="check-circle" size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Complete Stop</Text>
                      </Pressable>
                      </View>

                      {/* Test button for the current stop */}
                     

                      {isStuck && (
                        <Pressable
                          style={[styles.ghostBtn, { marginTop: 8, backgroundColor: '#fee2e2' }]}
                          onPress={() => resetStuckStop(stop._id, stop.stopName)}
                        >
                          <Text style={[styles.ghostBtnText, { color: '#dc2626', fontSize: 12 }]}>
                            🔄 Reset Stop (if stuck)
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}

                  {isNextStop && (
                    <Pressable
                      style={[styles.primaryBtn, { marginTop: 12 }]}
                      onPress={() => handleArriveAtStop(stop._id)}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                        <>
                          <Feather name="navigation" size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Arrive at Stop</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.card}>
              <Text style={styles.subtle}>No stops available for this route</Text>
            </View>
          )}
        </View>

        {/* Route Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route Summary</Text>
          <Text style={styles.subtle}>Today's performance overview</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Stops Completed</Text>
              <Text style={styles.summaryValue}>{completedStops}/{totalStops}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Sales</Text>
              <Text style={styles.summaryValue}>{totalSold} items</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={[styles.summaryValue, { color: tone.success }]}>
                ₹{totalRevenue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Avg per Stop</Text>
              <Text style={styles.summaryValue}>
                ₹{(totalRevenue / Math.max(completedStops, 1)).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
              <Text style={styles.summaryValue}>
                {totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0}%
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sales Rate</Text>
              <Text style={styles.summaryValue}>
                {totalAssigned > 0 ? Math.round((totalSold / totalAssigned) * 100) : 0}%
              </Text>
            </View>
          </View>
        </View>

        {/* Previous Routes Section */}
        <PreviousRoutesSection 
          assignments={completedAssignments}
          loading={loadingHistory}
          onViewSummary={handleViewSummary}
        />
      </ScrollView>

      <AcceptAssignmentModal
        visible={acceptModalVisible}
        onClose={() => setAcceptModalVisible(false)}
        onAccept={handleAcceptAssignment}
        assignment={assignment}
        loading={acceptLoading}
      />

      <StopSaleModal
        visible={saleModalVisible}
        onClose={() => {
          setSaleModalVisible(false);
          setSelectedStop(null);
        }}
        stop={selectedStop}
        inventory={assignment.inventory || []}
        assignmentId={assignment._id}
        onSaleRecorded={fetchAssignment}
      />

      <CompletionSummaryModal
        visible={completionModalVisible}
        onClose={() => {
          setCompletionModalVisible(false);
          fetchAssignment();
        }}
        assignment={assignment}
      />

      <AssignmentSummaryModal
        visible={summaryModalVisible}
        onClose={() => {
          setSummaryModalVisible(false);
          setSelectedAssignmentId(null);
        }}
        assignmentId={selectedAssignmentId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: '#f9fafb', minHeight: '100%' },
  h1: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtle: { color: '#6b7280' },
  subtleSmall: { color: '#6b7280', fontSize: 12 },

  mapWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eceff3',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  mapImage: {
    width: '100%',
    height: 180,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eceff3',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },

  row: { flexDirection: 'row' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 999 },
  progressContainer: { marginTop: 4, marginBottom: 8 },
  progressText: { fontSize: 10, color: '#6b7280', marginTop: 2, textAlign: 'right' },

  stopName: { fontWeight: '700', fontSize: 15, color: '#111827' },
  currentStopCard: { borderColor: '#2563eb', borderWidth: 2 },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef1f5',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 'auto',
  },

  vehicleInfo: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef1f5',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoText: { fontSize: 12, color: '#374151' },

  inventoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  statBig: { fontSize: 18, fontWeight: '800', color: '#111827' },

  listWrap: { borderWidth: 1, borderColor: '#eef1f5', borderRadius: 12, overflow: 'hidden' },
  listRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  listLeft: { fontWeight: '700', color: '#111827' },
  rightTop: { fontSize: 12, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#eef1f5' },

  stopTime: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  stopSales: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eef1f5' },
  stopSalesGrid: { flexDirection: 'row', gap: 16, marginTop: 4 },
  stopSalesItem: { flex: 1 },
  statValue: { fontWeight: '700', color: '#111827' },
  stopActions: { flexDirection: 'row', gap: 10, marginTop: 12 },

  primaryBtn: {
    backgroundColor: tone.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  successBtn: {
    backgroundColor: tone.success,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  ghostBtnText: { color: '#111827', fontWeight: '700' },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  summaryItem: { width: '30%', flexGrow: 1 },
  summaryLabel: { fontSize: 11, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 },

  emptyState: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 20,
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  modalCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '20%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },

  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  foodName: { fontWeight: '600', color: '#111827' },
  saleInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  acceptModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  acceptIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e6f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  acceptModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  acceptModalDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    color: '#111827',
    fontWeight: '600',
  },
  acceptModalActions: {
    gap: 10,
    marginBottom: 12,
  },
  acceptBtn: {
    backgroundColor: tone.success,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  rejectBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16,
  },
  acceptModalNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },

  completionModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  completionHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  completionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  completionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  completionStatItem: {
    alignItems: 'center',
  },
  completionStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  completionStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  completionDetails: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  completionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completionDetailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  completionDetailValue: {
    color: '#111827',
    fontWeight: '600',
  },
  completionBtn: {
    backgroundColor: tone.success,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  completionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // New styles for previous routes
  historyItem: {
    marginTop: 12,
    paddingTop: 12,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#eef1f5',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyRouteName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatText: {
    fontSize: 13,
    color: '#374151',
  },
  viewSummaryBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewSummaryBtnText: {
    color: tone.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  summaryModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  summaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  summaryModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryStatBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  summaryStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  summaryTimeInfo: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  summaryTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTimeText: {
    fontSize: 13,
    color: '#374151',
  },
  summarySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  summaryInventoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  summaryItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  summaryItemQty: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  summaryItemRevenue: {
    fontSize: 14,
    fontWeight: '700',
    color: tone.success,
  },
  summaryStopItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  summaryStopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryStopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  summaryStopSales: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  closeSummaryBtn: {
    backgroundColor: tone.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeSummaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});