// screens/MyRoute.tsx
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
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    // Validate quantities
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
      // Record each sale
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
      Alert.alert('Error', error?.message || 'Failed to record sales');
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

/* ---------- Main Screen ---------- */
export default function MyRouteScreen() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ApiResponse>('/api/rider/assignments/today');
      
      if (response.ok && response.assignment) {
        setAssignment(response.assignment);
      } else {
        setAssignment(null);
        if (response.message) {
          console.log('No assignment:', response.message);
        }
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

  useEffect(() => {
    fetchAssignment();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssignment();
  }, [fetchAssignment]);

  const handleArriveAtStop = async (stopId: string) => {
    if (!assignment?._id) return;
    
    try {
      setSaving(true);
      const res = await api.post(`/api/rider/stops/${stopId}/arrive`, {
        assignmentId: assignment._id
      });
      
      if (res.ok) {
        await fetchAssignment();
        Alert.alert('Success', 'Arrived at stop');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to mark arrival');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteStop = async (stopId: string) => {
    if (!assignment?._id) return;

    Alert.alert(
      'Complete Stop',
      'Have you recorded all sales for this stop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Complete',
          onPress: async () => {
            try {
              setSaving(true);
              const res = await api.post(`/api/rider/stops/${stopId}/complete`, {
                assignmentId: assignment._id
              });
              
              if (res.ok) {
                await fetchAssignment();
                Alert.alert('Success', 'Stop marked as complete');
              }
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to complete stop');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleStartAssignment = async () => {
    if (!assignment?._id) return;

    Alert.alert(
      'Start Route',
      'Are you ready to start your route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setSaving(true);
              const res = await api.post(`/api/rider/assignments/${assignment._id}/start`);
              
              if (res.ok) {
                await fetchAssignment();
                Alert.alert('Success', 'Route started!');
              }
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to start route');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // Safe calculations with null checks
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
      </ScrollView>
    );
  }

  return (
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
            text={assignment.status === 'active' ? 'Active' : 'Pending'}
            color={assignment.status === 'active' ? tone.success : tone.warning}
            solid
          />
        </View>

        <View>
          <View style={[styles.rowBetween, { marginBottom: 6 }]}>
            <Text style={styles.subtleSmall}>Route Progress</Text>
            <Text style={styles.subtleSmall}>
              {completedStops}/{totalStops} stops • {totalAssigned > 0 ? Math.round((totalSold/totalAssigned)*100) : 0}% sold
            </Text>
          </View>
          <ProgressBar value={progressPct} />
        </View>

        {/* Vehicle/Battery Info */}
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

        {/* Start Button */}
        {!assignment.startTime && assignment.status === 'pending' && (
          <Pressable 
            style={[styles.primaryBtn, { marginTop: 12 }]} 
            onPress={handleStartAssignment}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Start Route</Text>}
          </Pressable>
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

            return (
              <View
                key={stop?._id || index}
                style={[
                  styles.card,
                  isInProgress && styles.currentStopCard,
                ]}
              >
                <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={[styles.row, { alignItems: 'center', gap: 8, flexWrap: 'wrap' }]}>
                      <Text style={styles.stopName}>
                        {index + 1}. {stop?.stopName || 'Unknown Stop'}
                      </Text>
                      {isInProgress && <Badge text="Current" color={tone.primary} solid />}
                      {isCompleted && <Badge text="Completed" color={tone.success} solid />}
                      {isPending && !isInProgress && <Badge text="Upcoming" color={tone.gray} solid={false} />}
                    </View>
                    {stop?.address && <Text style={styles.subtleSmall}>{stop.address}</Text>}
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

                {/* Action buttons */}
                {isInProgress && (
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
                      onPress={() => handleCompleteStop(stop._id)}
                    >
                      <Feather name="check-circle" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Complete Stop</Text>
                    </Pressable>
                  </View>
                )}

                {isPending && index === completedStops && !inProgressStop && (
                  <Pressable
                    style={[styles.primaryBtn, { marginTop: 12 }]}
                    onPress={() => handleArriveAtStop(stop._id)}
                  >
                    <Feather name="navigation" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Arrive at Stop</Text>
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

      {/* Record Sales Modal */}
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
    </ScrollView>
  );
}

/* ---------- Styles ---------- */
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
});