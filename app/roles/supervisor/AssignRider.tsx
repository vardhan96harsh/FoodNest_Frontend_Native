// screens/AssignRider.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";

/* ---------- Types (Matching Backend) ---------- */
type Rider = {
  _id: string;
  name: string;
  email: string;
  status?: 'Available' | 'Active' | 'Off Duty';
};

type Vehicle = {
  _id: string;
  registrationNo: string;
  type: 'Cart' | 'Bike';
  status: 'Available' | 'In Use' | 'Maintenance';
};

type Route = {
  _id: string;
  name: string;
  stops: Array<{ name: string; order?: number }>;
  status?: 'Available' | 'Assigned';
};

type Battery = {
  _id: string;
  imei: string;
  vehicleId?: string;
  status: 'Excellent' | 'Good' | 'Low';
  charge: number;
  health: number;
  lastCharge?: string;
};

type InventoryItem = {
  foodItem: string;
  name: string;
  quantity: number;
  locked: number;
  available: number;
  price: number;
  isPermanent?: boolean;
  source?: 'daily' | 'permanent';
};

type AssignmentInventoryItem = {
  foodItem: {
    _id: string;
    name: string;
    price: number;
  };
  quantityAssigned: number;
  quantityRemaining: number;
  quantitySold: number;
  source?: string;
};

type Assignment = {
  _id: string;
  rider: {
    _id: string;
    name: string;
  } | null;
  vehicle: {
    _id: string;
    registrationNo: string;
  } | null;
  battery: {
    _id: string;
    imei: string;
  } | null;
  route: {
    _id: string;
    name: string;
  } | null;
  inventory: AssignmentInventoryItem[];
  date: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending';
  createdAt: string;
  closedAt?: string;
  cancellationReason?: string;
};

type FoodPick = {
  foodItemId: string;
  name: string;
  quantity: number;
  price: number;
  available: number;
  isPermanent?: boolean;
  source?: string;
};

type TeamResponse = {
  ok: boolean;
  team: {
    riders: Rider[];
    vehicles: Vehicle[];
    routes: Route[];
    batteries: Battery[];
    cooks: any[];
    refillCoordinators: any[];
    activeAssignments?: Array<{
      vehicleId: string;
      batteryId: string;
      riderId: string;
    }>;
  };
};

type AvailableItemsResponse = {
  ok: boolean;
  items: Array<{
    foodItemId: string;
    name: string;
    price: number;
    category: string;
    totalQuantity: number;
    locked: number;
    available: number;
    imageUrl?: string;
    isPermanent?: boolean;
    source?: string;
  }>;
  summary: {
    totalItems: number;
    totalAvailable: number;
    totalValue?: number;
    dailyCount?: number;
    permanentCount?: number;
  };
};

type AssignmentsResponse = {
  ok: boolean;
  assignments?: Assignment[];
  summary?: any;
};

/* ---------- Small Badge ---------- */
function Badge({
  text,
  variant = 'solid',
  color = '#2563eb',
}: {
  text: string;
  variant?: 'solid' | 'outline';
  color?: string;
}) {
  const solid = variant === 'solid';
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: solid ? color : 'transparent',
          borderColor: color,
        },
      ]}
    >
      <Text
        style={{
          color: solid ? '#fff' : color,
          fontSize: 11,
          fontWeight: '700',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/* ---------- Bottom-sheet style picker ---------- */
function PickerSheet<T extends { _id: string } & Record<string, any>>({
  visible,
  onClose,
  title,
  items,
  renderLeft,
  renderRight,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: T[];
  renderLeft: (o: T) => React.ReactNode;
  renderRight?: (o: T) => React.ReactNode;
  onSelect: (o: T) => void;
}) {
  return (
    <Modal
      transparent
      animationType='slide'
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose}>
            <Feather name='x' size={20} />
          </Pressable>
        </View>
        <ScrollView>
          {!items || items.length === 0 ? (
            <Text style={styles.emptyText}>No items available</Text>
          ) : (
            items.map((o) => (
              <Pressable
                key={o._id}
                style={styles.optionRow}
                onPress={() => {
                  onSelect(o);
                  onClose();
                }}
              >
                <View style={[styles.row, { alignItems: 'center', gap: 10, flex: 1 }]}>
                  {renderLeft(o)}
                </View>
                <View>{renderRight ? renderRight(o) : null}</View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function AssignRiderScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data states
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Modal open
  const [isOpen, setIsOpen] = useState(false);
  
  // Edit mode
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Selections
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<Battery | null>(null);

  // Food selection
  const [selectedFoodItems, setSelectedFoodItems] = useState<FoodPick[]>([]);
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [currentFoodItem, setCurrentFoodItem] = useState<InventoryItem | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState<string>('');

  // Picker toggles
  const [riderOpen, setRiderOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);

  // ========== Fetch Available Items ==========
  const fetchAvailableItems = useCallback(async () => {
    try {
      const res = await api.get<AvailableItemsResponse>("/api/supervisor/assignments/available-items");
      if (res?.ok && Array.isArray(res?.items)) {
        const items = res.items.map((item) => ({
          foodItem: item?.foodItemId || '',
          name: item?.name || 'Unknown',
          quantity: item?.totalQuantity || 0,
          locked: item?.locked || 0,
          available: item?.available || 0,
          price: item?.price || 0,
          isPermanent: item?.isPermanent || false,
          source: item?.source || 'daily'
        }));
        setInventory(items);
      } else {
        setInventory([]);
      }
    } catch (err) {
      console.error("Failed to fetch available items:", err);
      setInventory([]);
    }
  }, []);

  // ========== Check Resource Availability ==========
  const checkResourceAvailability = async (): Promise<boolean> => {
    try {
      const teamRes = await api.get<TeamResponse>("/api/supervisor/my-team");
      
      if (!teamRes?.ok || !teamRes?.team) {
        Alert.alert("Error", "Could not verify resource availability");
        return false;
      }

      const { vehicles = [], batteries = [], riders = [] } = teamRes.team || {};

      const vehicleStillAvailable = vehicles.some(v => v?._id === selectedVehicle?._id);
      const batteryStillAvailable = batteries.some(b => b?._id === selectedBattery?._id);
      const riderStillAvailable = riders.some(r => r?._id === selectedRider?._id && r?.status !== 'Active');

      if (!vehicleStillAvailable) {
        Alert.alert("Not Available", "Selected vehicle is no longer available");
        return false;
      }

      if (!batteryStillAvailable) {
        Alert.alert("Not Available", "Selected battery is no longer available");
        return false;
      }

      if (!riderStillAvailable) {
        Alert.alert("Not Available", "Selected rider is no longer available");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Resource check error:", error);
      Alert.alert("Error", "Failed to verify resource availability");
      return false;
    }
  };

  // ========== Fetch All Data ==========
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const teamRes = await api.get<TeamResponse>("/api/supervisor/my-team");
      
      if (teamRes?.ok && teamRes?.team) {
        setRiders(Array.isArray(teamRes.team.riders) ? teamRes.team.riders : []);
        setVehicles(Array.isArray(teamRes.team.vehicles) ? teamRes.team.vehicles : []);
        setRoutes(Array.isArray(teamRes.team.routes) ? teamRes.team.routes : []);
        setBatteries(Array.isArray(teamRes.team.batteries) ? teamRes.team.batteries : []);
      }

      await fetchAvailableItems();

      try {
        const assignmentsRes = await api.get<AssignmentsResponse>("/api/supervisor/assignments/today");
        
        const rawAssignments = assignmentsRes?.assignments || [];
        
        if (Array.isArray(rawAssignments)) {
          const validAssignments = rawAssignments
            .filter(a => a && a._id)
            .map(a => ({
              _id: a._id || '',
              rider: a?.rider ? { 
                _id: a.rider._id || 'unknown', 
                name: a.rider.name || 'Unknown Rider' 
              } : null,
              vehicle: a?.vehicle ? { 
                _id: a.vehicle._id || 'unknown', 
                registrationNo: a.vehicle.registrationNo || 'Unknown Vehicle' 
              } : null,
              battery: a?.battery ? { 
                _id: a.battery._id || 'unknown', 
                imei: a.battery.imei || 'Unknown Battery' 
              } : null,
              route: a?.route ? { 
                _id: a.route._id || 'unknown', 
                name: a.route.name || 'Unknown Route' 
              } : null,
              inventory: Array.isArray(a?.inventory) 
                ? a.inventory.map(item => ({
                    foodItem: item?.foodItem ? {
                      _id: item.foodItem._id || 'unknown',
                      name: item.foodItem.name || 'Unknown Item',
                      price: item.foodItem.price || 0
                    } : { _id: 'unknown', name: 'Unknown Item', price: 0 },
                    quantityAssigned: item?.quantityAssigned || 0,
                    quantityRemaining: item?.quantityRemaining || 0,
                    quantitySold: item?.quantitySold || 0,
                    source: item?.source || 'daily'
                  }))
                : [],
              date: a?.date || new Date().toISOString(),
              status: a?.status || 'pending',
              createdAt: a?.createdAt || new Date().toISOString(),
              closedAt: a?.closedAt,
              cancellationReason: a?.cancellationReason
            }));
          
          setAssignments(validAssignments);
        } else {
          setAssignments([]);
        }
      } catch (err) {
        console.warn("Failed to fetch assignments", err);
        setAssignments([]);
      }

    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchAvailableItems]);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ========== Computed Values ==========
  const availableRiders = useMemo(
    () => (Array.isArray(riders) ? riders.filter(r => r && r.status !== 'Active') : []),
    [riders]
  );

  const availableVehicles = useMemo(
    () => (Array.isArray(vehicles) ? vehicles.filter(v => v && v.status === 'Available') : []),
    [vehicles]
  );

  const availableRoutes = useMemo(
    () => (Array.isArray(routes) ? routes.filter(r => r && r.status !== 'Assigned') : []),
    [routes]
  );

  const availableBatteries = useMemo(
    () => (Array.isArray(batteries) ? batteries.filter(b => b && b.status !== 'Low' && (b.health || 0) > 70) : []),
    [batteries]
  );

  const remainingFoodOptions = useMemo(
    () => (Array.isArray(inventory) ? inventory.filter(
      (item) => item && item.available > 0 && 
      !selectedFoodItems.find((s) => s && s.foodItemId === item.foodItem)
    ) : []),
    [inventory, selectedFoodItems]
  );

  const canCreate =
    !!selectedRider &&
    !!selectedVehicle &&
    !!selectedBattery &&
    !!selectedRoute &&
    selectedFoodItems.length > 0;

  const totalItems = useMemo(
    () => selectedFoodItems.reduce((sum, i) => sum + (i?.quantity || 0), 0),
    [selectedFoodItems]
  );

  const permanentCount = useMemo(
    () => selectedFoodItems.filter(i => i?.isPermanent).length,
    [selectedFoodItems]
  );

  const dailyCount = useMemo(
    () => selectedFoodItems.filter(i => !i?.isPermanent).length,
    [selectedFoodItems]
  );

  // ========== Actions ==========
  const resetModal = () => {
    setSelectedRider(null);
    setSelectedVehicle(null);
    setSelectedBattery(null);
    setSelectedRoute(null);
    setSelectedFoodItems([]);
    setCurrentFoodItem(null);
    setCurrentQuantity('');
    setEditingAssignment(null);
  };

  const openAssignmentModal = async () => {
    await fetchAvailableItems();
    setIsOpen(true);
  };

  const openEditModal = async (assignment: Assignment) => {
    // Only allow editing pending assignments
    if (assignment.status !== 'pending') {
      Alert.alert("Cannot Edit", "Only pending assignments can be edited");
      return;
    }
    
    setEditingAssignment(assignment);
    
    // Find and set the resources
    const rider = riders.find(r => r._id === assignment.rider?._id);
    const vehicle = vehicles.find(v => v._id === assignment.vehicle?._id);
    const battery = batteries.find(b => b._id === assignment.battery?._id);
    const route = routes.find(r => r._id === assignment.route?._id);
    
    setSelectedRider(rider || null);
    setSelectedVehicle(vehicle || null);
    setSelectedBattery(battery || null);
    setSelectedRoute(route || null);
    
    // Convert existing inventory items to FoodPick format
    const existingItems: FoodPick[] = assignment.inventory.map(item => ({
      foodItemId: item.foodItem._id,
      name: item.foodItem.name,
      quantity: item.quantityAssigned,
      price: item.foodItem.price,
      available: item.quantityAssigned,
      isPermanent: item.source === 'permanent',
      source: item.source
    }));
    
    setSelectedFoodItems(existingItems);
    
    // Open the modal
    setIsOpen(true);
  };

  const addFoodItem = () => {
    if (!currentFoodItem) {
      Alert.alert('Error', 'Please select a food item');
      return;
    }

    const qty = Number(currentQuantity.replace(/[^\d]/g, '')) || 0;
    
    if (qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (qty > (currentFoodItem.available || 0)) {
      Alert.alert('Error', `Only ${currentFoodItem.available} items available`);
      return;
    }

    if (selectedFoodItems.find((s) => s?.foodItemId === currentFoodItem.foodItem)) {
      Alert.alert('Error', 'Item already added');
      return;
    }

    setSelectedFoodItems((prev) => [
      ...prev,
      {
        foodItemId: currentFoodItem.foodItem,
        name: currentFoodItem.name || 'Unknown',
        quantity: qty,
        price: currentFoodItem.price || 0,
        available: currentFoodItem.available || 0,
        isPermanent: currentFoodItem.isPermanent || false,
        source: currentFoodItem.source || 'daily'
      },
    ]);

    setCurrentFoodItem(null);
    setCurrentQuantity('');
  };

  const removeFoodItem = (foodItemId: string) => {
    setSelectedFoodItems((prev) => prev.filter((f) => f?.foodItemId !== foodItemId));
  };

  const validateInventory = async (): Promise<boolean> => {
    try {
      const res = await api.get<AvailableItemsResponse>("/api/supervisor/assignments/available-items");
      const currentInventory = (res?.items) || [];

      for (const item of selectedFoodItems) {
        const stockItem = currentInventory.find(i => i?.foodItemId === item?.foodItemId);
        if (!stockItem || (stockItem.available || 0) < (item?.quantity || 0)) {
          Alert.alert(
            "Insufficient Stock",
            `${item?.name || 'Item'} only has ${stockItem?.available || 0} available`
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Validation error:", error);
      Alert.alert("Error", "Failed to validate inventory");
      return false;
    }
  };

  const createAssignment = async () => {
    if (!canCreate) return;

    const isValid = await validateInventory();
    if (!isValid) return;

    const resourcesAvailable = await checkResourceAvailability();
    if (!resourcesAvailable) return;

    try {
      setSaving(true);

      const assignmentRes = await api.post("/api/supervisor/assignments/create", {
        routeId: selectedRoute!._id,
        riderId: selectedRider!._id,
        vehicleId: selectedVehicle!._id,
        batteryId: selectedBattery!._id,
        items: selectedFoodItems.map(item => ({
          foodItemId: item.foodItemId,
          quantity: item.quantity
        }))
      });

      if (assignmentRes?.ok) {
        await fetchData();
        setIsOpen(false);
        resetModal();
        Alert.alert('Success', 'Assignment created successfully');
      }
    } catch (err: any) {
      console.error("Create assignment error:", err);
      
      if (err?.message?.includes("already assigned")) {
        Alert.alert('Resource Unavailable', err.message);
        await fetchData();
      } else {
        Alert.alert('Error', err?.message || 'Failed to create assignment');
      }
    } finally {
      setSaving(false);
    }
  };

  const updateAssignment = async () => {
    if (!canCreate || !editingAssignment) return;
    
    const isValid = await validateInventory();
    if (!isValid) return;
    
    const resourcesAvailable = await checkResourceAvailability();
    if (!resourcesAvailable) return;
    
    try {
      setSaving(true);
      
      const updateRes = await api.put(`/api/supervisor/assignments/${editingAssignment._id}`, {
        riderId: selectedRider!._id,
        vehicleId: selectedVehicle!._id,
        batteryId: selectedBattery!._id,
        items: selectedFoodItems.map(item => ({
          foodItemId: item.foodItemId,
          quantity: item.quantity
        }))
      });
      
      if (updateRes?.ok) {
        await fetchData();
        setIsOpen(false);
        resetModal();
        Alert.alert('Success', 'Assignment updated successfully');
      } else {
        Alert.alert('Error', updateRes?.error || 'Failed to update assignment');
      }
    } catch (err: any) {
      console.error("Update assignment error:", err);
      Alert.alert('Error', err?.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

 const deleteAssignment = async (assignmentId: string) => {
  Alert.alert(
    "Cancel Assignment",
    "Are you sure you want to cancel this assignment? All resources will be freed and inventory will be unlocked.",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            
            console.log(`[Delete] Attempting to delete assignment: ${assignmentId}`);
            
            let res;
            
            // Try DELETE method first
            try {
              console.log("[Delete] Trying DELETE method...");
              res = await api.delete(`/api/supervisor/assignments/${assignmentId}`);
              console.log("[Delete] DELETE response:", res);
            } catch (deleteError: any) {
              console.error("[Delete] DELETE failed:", deleteError);
              console.log("[Delete] Falling back to POST cancel endpoint...");
              
              // If DELETE fails, try POST to cancel endpoint
              res = await api.post(`/api/supervisor/assignments/${assignmentId}/cancel`, {
                reason: "Cancelled by supervisor"
              });
              console.log("[Delete] POST cancel response:", res);
            }
            
            if (res?.ok) {
              await fetchData();
              Alert.alert("Success", "Assignment cancelled successfully");
            } else {
              Alert.alert("Error", res?.error || "Failed to cancel assignment");
            }
          } catch (err: any) {
            console.error("[Delete] Final error:", err);
            Alert.alert(
              "Error", 
              err?.message || err?.error || "Failed to cancel assignment. Please try again."
            );
          } finally {
            setSaving(false);
          }
        }
      }
    ]
  );
};

  const closeAssignment = async (assignmentId: string) => {
    Alert.alert(
      "Close Assignment",
      "Are you sure you want to close this assignment? This will finalize all sales and free up resources.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Close",
          onPress: async () => {
            try {
              setSaving(true);
              
              const res = await api.post(`/api/supervisor/assignments/${assignmentId}/close`);
              
              if (res?.ok) {
                await fetchData();
                Alert.alert("Success", "Assignment closed successfully");
              } else {
                Alert.alert("Error", res?.error || "Failed to close assignment");
              }
            } catch (err: any) {
              console.error("Close error:", err);
              Alert.alert("Error", err?.message || "Failed to close assignment");
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const batteryStatusDot = (status: Battery['status'] = 'Good') => {
    const bg =
      status === 'Excellent'
        ? '#16a34a'
        : status === 'Good'
        ? '#2563eb'
        : '#dc2626';
    return <View style={[styles.badgeDot, { backgroundColor: bg }]} />;
  };

  const getBatteryDisplay = (battery: Battery | null) => {
    if (!battery) return 'Unknown Battery';
    return `${battery.imei?.slice(-4) || 'N/A'} • ${battery.charge || 0}% • ${battery.health || 0}%`;
  };

  const getStatusColor = (status: string = 'pending') => {
    switch (status) {
      case 'active': return '#16a34a';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string = 'pending') => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status || 'Unknown';
    }
  };

  const getRiderName = (rider: any): string => {
    return rider?.name || 'Unknown Rider';
  };

  const getVehicleReg = (vehicle: any): string => {
    return vehicle?.registrationNo || 'Unknown Vehicle';
  };

  const getBatteryImei = (battery: any): string => {
    return battery?.imei?.slice(-4) || 'N/A';
  };

  const getRouteName = (route: any): string => {
    return route?.name || 'Unknown Route';
  };

  const getInventoryTotal = (inventory: AssignmentInventoryItem[] = []): number => {
    return (inventory || []).reduce((sum, i) => sum + (i?.quantityAssigned || 0), 0);
  };

  const getSoldTotal = (inventory: AssignmentInventoryItem[] = []): number => {
    return (inventory || []).reduce((sum, i) => sum + (i?.quantitySold || 0), 0);
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading team data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Rider Assignment</Text>
          <Text style={styles.subtle}>
            Assign riders with real-time inventory tracking
          </Text>
        </View>
      </View>

      {/* New actions row for the button */}
      <View style={styles.actionsRow}>
        <Pressable onPress={openAssignmentModal}>
          <LinearGradient
            colors={['#FDE047', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBtn}
          >
            <Feather name='plus' size={16} color='#ffffff' style={{ marginRight: 8 }} />
            <Text style={styles.gradientBtnText}>New Assignment</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Inventory Summary Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today's Inventory</Text>
        <Text style={styles.subtle}>Available stock for assignment</Text>
        
        <View style={styles.inventoryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Array.isArray(inventory) ? inventory.reduce((sum, i) => sum + (i?.available || 0), 0) : 0}
            </Text>
            <Text style={styles.statLabel}>Total Available</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Array.isArray(inventory) ? inventory.filter(i => i?.isPermanent).length : 0}
            </Text>
            <Text style={styles.statLabel}>Permanent Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Array.isArray(inventory) ? inventory.filter(i => !i?.isPermanent).length : 0}
            </Text>
            <Text style={styles.statLabel}>Daily Items</Text>
          </View>
        </View>

        <View style={styles.chipsWrap}>
          {Array.isArray(inventory) && inventory.slice(0, 5).map((item, index) => (
            <View key={item?.foodItem || index.toString()} style={styles.chip}>
              <Text style={styles.chipText}>
                {item?.name || 'Unknown'}: {item?.available || 0}
                {item?.isPermanent && ' 🔷'}
              </Text>
            </View>
          ))}
          {Array.isArray(inventory) && inventory.length > 5 && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>+{inventory.length - 5} more</Text>
            </View>
          )}
        </View>
      </View>

      {/* Current Assignments */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Assignments</Text>
        <Text style={styles.subtle}>
          Active rider assignments and their inventory
        </Text>

        <View style={{ height: 12 }} />
        {!Array.isArray(assignments) || assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="truck" size={40} color="#d1d5db" />
            <Text style={[styles.subtle, { marginTop: 8 }]}>No active assignments</Text>
          </View>
        ) : (
          <View style={{ rowGap: 12 }}>
            {assignments.map((a) => {
              if (!a || !a._id) return null;
              
              const inventory = Array.isArray(a.inventory) ? a.inventory : [];
              const totalAssigned = getInventoryTotal(inventory);
              const totalSold = getSoldTotal(inventory);
              const progressPercent = totalAssigned > 0 ? (totalSold / totalAssigned) * 100 : 0;
              
              return (
                <View key={a._id} style={styles.assignmentCard}>
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <View style={[styles.row, { alignItems: 'center', gap: 10, flex: 1 }]}>
                      <Badge
                        text={getStatusText(a.status)}
                        color={getStatusColor(a.status)}
                        variant='solid'
                      />
                      <Text style={{ fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                        {getRiderName(a.rider)}
                      </Text>
                    </View>
                    <View style={[styles.row, { gap: 8, alignItems: 'center' }]}>
                      <Text style={styles.subtleSmall}>
                        {a.date ? new Date(a.date).toLocaleDateString() : 'N/A'}
                      </Text>
                      
                      {/* Action buttons based on status */}
                      {a.status === 'active' && (
                        <>
                          <Pressable 
                            onPress={() => closeAssignment(a._id)}
                            style={({ pressed }) => [
                              styles.iconBtn,
                              pressed && { opacity: 0.7 },
                              { padding: 4 }
                            ]}
                          >
                            <Feather name="check-circle" size={16} color="#16a34a" />
                          </Pressable>
                          <Pressable 
                            onPress={() => deleteAssignment(a._id)}
                            style={({ pressed }) => [
                              styles.iconBtn,
                              pressed && { opacity: 0.7 },
                              { padding: 4 }
                            ]}
                          >
                            <Feather name="trash-2" size={16} color="#dc2626" />
                          </Pressable>
                        </>
                      )}
                      
                      {a.status === 'pending' && (
                        <>
                          <Pressable 
                            onPress={() => openEditModal(a)}
                            style={({ pressed }) => [
                              styles.iconBtn,
                              pressed && { opacity: 0.7 },
                              { padding: 4 }
                            ]}
                          >
                            <Feather name="edit-2" size={16} color="#2563eb" />
                          </Pressable>
                          <Pressable 
                            onPress={() => deleteAssignment(a._id)}
                            style={({ pressed }) => [
                              styles.iconBtn,
                              pressed && { opacity: 0.7 },
                              { padding: 4 }
                            ]}
                          >
                            <Feather name="trash-2" size={16} color="#dc2626" />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={styles.assignmentGrid}>
                    <Text>
                      <Text style={styles.bold}>Vehicle:</Text> {getVehicleReg(a.vehicle)}
                    </Text>
                    <Text>
                      <Text style={styles.bold}>Battery:</Text> {getBatteryImei(a.battery)}
                    </Text>
                    <Text>
                      <Text style={styles.bold}>Route:</Text> {getRouteName(a.route)}
                    </Text>
                  </View>

                  <View style={styles.chipsWrap}>
                    {inventory.map((item, idx) => (
                      <View key={idx} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {item?.foodItem?.name || 'Unknown'}: {item?.quantityAssigned || 0} 
                          {(item?.quantitySold || 0) > 0 && ` (${item.quantitySold} sold)`}
                          {item?.source === 'permanent' && ' 🔷'}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {a.status === 'active' && totalSold > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.subtleSmall}>Sales Progress</Text>
                      <View style={styles.progressTrack}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${Math.min(progressPercent, 100)}%` }
                          ]} 
                        />
                      </View>
                    </View>
                  )}

                  {a.status === 'cancelled' && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 }}>
                      <Text style={{ color: '#dc2626', fontSize: 12 }}>
                        Cancelled • Resources freed
                        {a.closedAt && ` at ${new Date(a.closedAt).toLocaleTimeString()}`}
                      </Text>
                    </View>
                  )}

                  {a.status === 'completed' && a.closedAt && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 8 }}>
                      <Text style={{ color: '#16a34a', fontSize: 12 }}>
                        Completed at {new Date(a.closedAt).toLocaleTimeString()}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* New/Edit Assignment Modal */}
      <Modal
        transparent
        animationType='slide'
        visible={isOpen}
        onRequestClose={() => {
          setIsOpen(false);
          resetModal();
        }}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => {
          setIsOpen(false);
          resetModal();
        }} />
        <View style={styles.modalCard}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <View>
              <Text style={styles.modalTitle}>
                {editingAssignment ? 'Edit Rider Assignment' : 'Create Rider Assignment'}
              </Text>
              <Text style={styles.subtleSmall}>
                {editingAssignment ? 'Modify assignment details' : 'Assign with real-time inventory tracking'}
              </Text>
            </View>
            <Pressable onPress={() => {
              setIsOpen(false);
              resetModal();
            }}>
              <Feather name='x' size={22} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            {/* Rider + Vehicle */}
            <View style={styles.grid2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Select Rider</Text>
                <Pressable
                  style={styles.inputLike}
                  onPress={() => setRiderOpen(true)}
                >
                  <Text
                    style={
                      selectedRider
                        ? styles.inputValue
                        : styles.inputPlaceholder
                    }
                  >
                    {selectedRider
                      ? selectedRider.name
                      : 'Choose rider'}
                  </Text>
                  <Feather name='chevron-down' size={18} color='#6b7280' />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Select Vehicle</Text>
                <Pressable
                  style={styles.inputLike}
                  onPress={() => setVehicleOpen(true)}
                >
                  <Text
                    style={
                      selectedVehicle
                        ? styles.inputValue
                        : styles.inputPlaceholder
                    }
                  >
                    {selectedVehicle
                      ? `${selectedVehicle.registrationNo} - ${selectedVehicle.type}`
                      : 'Choose vehicle'}
                  </Text>
                  <Feather name='chevron-down' size={18} color='#6b7280' />
                </Pressable>
              </View>
            </View>

            {/* Battery */}
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Select Battery</Text>
              <Pressable
                style={styles.inputLike}
                onPress={() => setBatteryOpen(true)}
              >
                <Text
                  style={
                    selectedBattery
                      ? styles.inputValue
                      : styles.inputPlaceholder
                  }
                >
                  {selectedBattery
                    ? getBatteryDisplay(selectedBattery)
                    : 'Choose battery'}
                </Text>
                <Feather name='chevron-down' size={18} color='#6b7280' />
              </Pressable>
            </View>

            {/* Route */}
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Select Route</Text>
              <Pressable
                style={styles.inputLike}
                onPress={() => setRouteOpen(true)}
              >
                <Text
                  style={
                    selectedRoute ? styles.inputValue : styles.inputPlaceholder
                  }
                >
                  {selectedRoute
                    ? `${selectedRoute.name} - ${selectedRoute.stops?.length || 0} stops`
                    : 'Choose route'}
                </Text>
                <Feather name='chevron-down' size={18} color='#6b7280' />
              </Pressable>
            </View>

            {/* Assign Food Items */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>Assign Food Items (Available in Inventory)</Text>
              <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                <Pressable
                  style={[styles.inputLike, { flex: 1 }]}
                  onPress={() => setFoodPickerOpen(true)}
                >
                  <Text
                    style={
                      currentFoodItem
                        ? styles.inputValue
                        : styles.inputPlaceholder
                    }
                  >
                    {currentFoodItem
                      ? `${currentFoodItem.name} (Available: ${currentFoodItem.available})${currentFoodItem.isPermanent ? ' 🔷 Permanent' : ' 📦 Daily'}`
                      : 'Select food item'}
                  </Text>
                  <Feather name='chevron-down' size={18} color='#6b7280' />
                </Pressable>
                <TextInput
                  style={[styles.qtyInput, { width: 80 }]}
                  placeholder='Qty'
                  keyboardType='number-pad'
                  value={currentQuantity}
                  onChangeText={(t) => setCurrentQuantity(t.replace(/[^\d]/g, ''))}
                />
                <Pressable style={styles.outlineBtn} onPress={addFoodItem}>
                  <Feather name='plus' size={16} />
                </Pressable>
              </View>

              {selectedFoodItems.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.label}>Selected Items (Will be locked)</Text>
                  <View style={{ rowGap: 8 }}>
                    {selectedFoodItems.map((fi) => (
                      <View key={fi.foodItemId} style={styles.selectedRow}>
                        <View>
                          <Text style={{ fontWeight: '600' }}>{fi.name}</Text>
                          <Text style={styles.subtleSmall}>
                            Qty: {fi.quantity} • Price: ₹{fi.price}
                            {fi.isPermanent ? ' 🔷 Permanent Stock' : ' 📦 Daily Stock'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeFoodItem(fi.foodItemId)}
                          style={styles.iconBtn}
                        >
                          <Feather name='x' size={16} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Summary */}
            {selectedRider &&
              selectedVehicle &&
              selectedBattery &&
              selectedRoute &&
              selectedFoodItems.length > 0 && (
                <View style={styles.summarySection}>
                  <Text style={styles.label}>Assignment Summary</Text>
                  <View style={{ rowGap: 6, marginTop: 6 }}>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <Feather name='user-check' size={16} color="#2563eb" />
                      <Text>Rider: <Text style={styles.bold}>{selectedRider.name}</Text></Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <Feather name='truck' size={16} color="#2563eb" />
                      <Text>Vehicle: <Text style={styles.bold}>{selectedVehicle.registrationNo}</Text></Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <MaterialCommunityIcons name='battery' size={16} color="#2563eb" />
                      <Text>Battery: <Text style={styles.bold}>{selectedBattery.imei.slice(-4)}</Text> ({selectedBattery.charge}%)</Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <Feather name='map-pin' size={16} color="#2563eb" />
                      <Text>Route: <Text style={styles.bold}>{selectedRoute.name}</Text></Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <Feather name='shopping-bag' size={16} color="#2563eb" />
                      <Text>Items: <Text style={styles.bold}>{selectedFoodItems.length}</Text> items, <Text style={styles.bold}>{totalItems}</Text> total quantity</Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
                      <Feather name='layers' size={16} color="#2563eb" />
                      <Text>Permanent: <Text style={styles.bold}>{permanentCount}</Text> • Daily: <Text style={styles.bold}>{dailyCount}</Text></Text>
                    </View>
                  </View>
                </View>
              )}

            {/* Actions */}
            <View style={styles.actionButtons}>
              <Pressable
                onPress={editingAssignment ? updateAssignment : createAssignment}
                disabled={!canCreate || saving}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!canCreate || pressed || saving) && { opacity: 0.9 },
                  { flex: 1, justifyContent: 'center' },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name={editingAssignment ? 'edit-2' : 'check'} size={16} color='#fff' style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>
                      {editingAssignment ? 'Update Assignment' : 'Create Assignment'}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsOpen(false);
                  resetModal();
                }}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && { opacity: 0.85 },
                  { flex: 1, justifyContent: 'center' },
                ]}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Picker sheets */}
      <PickerSheet
        visible={riderOpen}
        onClose={() => setRiderOpen(false)}
        title='Choose rider'
        items={availableRiders.filter(r => r)}
        renderLeft={(r: Rider) => (
          <>
            <Feather name='user' size={16} color='#111827' />
            <Text style={{ fontWeight: '600', color: '#111827' }}>{r.name}</Text>
          </>
        )}
        renderRight={(r: Rider) => (
          <Badge
            text={r.status || 'Available'}
            variant={r.status !== 'Active' ? 'solid' : 'outline'}
            color={r.status !== 'Active' ? '#059669' : '#6b7280'}
          />
        )}
        onSelect={(r) => setSelectedRider(r)}
      />

      <PickerSheet
        visible={vehicleOpen}
        onClose={() => setVehicleOpen(false)}
        title='Choose vehicle'
        items={availableVehicles.filter(v => v)}
        renderLeft={(v: Vehicle) => (
          <>
            <Feather name='truck' size={16} color='#111827' />
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              {v.registrationNo} - {v.type}
            </Text>
          </>
        )}
        renderRight={(v: Vehicle) => (
          <Badge
            text={v.status}
            variant={v.status === 'Available' ? 'solid' : 'outline'}
            color={v.status === 'Available' ? '#059669' : '#6b7280'}
          />
        )}
        onSelect={(v) => setSelectedVehicle(v)}
      />

      <PickerSheet
        visible={batteryOpen}
        onClose={() => setBatteryOpen(false)}
        title='Choose battery'
        items={availableBatteries.filter(b => b)}
        renderLeft={(b: Battery) => (
          <>
            <MaterialCommunityIcons name='battery' size={16} color='#111827' />
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              {b.imei.slice(-4)} • {b.charge}%
            </Text>
          </>
        )}
        renderRight={(b: Battery) => (
          <View style={[styles.row, { alignItems: 'center', gap: 6 }]}>
            {batteryStatusDot(b.status)}
            <Text style={styles.subtleSmall}>Health: {b.health}%</Text>
          </View>
        )}
        onSelect={(b) => setSelectedBattery(b)}
      />

      <PickerSheet
        visible={routeOpen}
        onClose={() => setRouteOpen(false)}
        title='Choose route'
        items={availableRoutes.filter(r => r)}
        renderLeft={(rt: Route) => (
          <>
            <Feather name='map' size={16} color='#111827' />
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              {rt.name} - {rt.stops?.length || 0} stops
            </Text>
          </>
        )}
        renderRight={(rt: Route) => (
          <Badge
            text={rt.status || 'Available'}
            variant={rt.status !== 'Assigned' ? 'solid' : 'outline'}
            color={rt.status !== 'Assigned' ? '#059669' : '#6b7280'}
          />
        )}
        onSelect={(rt) => setSelectedRoute(rt)}
      />

      <PickerSheet
        visible={foodPickerOpen}
        onClose={() => setFoodPickerOpen(false)}
        title='Select food item from inventory'
        items={remainingFoodOptions.filter(f => f)}
        renderLeft={(f: InventoryItem) => (
          <>
            <Feather name='box' size={16} color='#111827' />
            <View>
              <Text style={{ fontWeight: '600', color: '#111827' }}>{f.name}</Text>
              <Text style={styles.subtleSmall}>
                {f.isPermanent ? '🔷 Permanent Stock' : '📦 Daily Stock'}
              </Text>
            </View>
          </>
        )}
        renderRight={(f: InventoryItem) => (
          <Text style={styles.subtleSmall}>
            Avail: {f.available} • ₹{f.price}
          </Text>
        )}
        onSelect={(f) => setCurrentFoodItem(f)}
      />
    </ScrollView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: '#f9fafb' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  h1: { fontSize: 22, fontWeight: '800', color: '#111827' },
  bold: { fontWeight: '800', color: '#111827' },
  subtle: { color: '#6b7280' },
  subtleSmall: { color: '#6b7280', fontSize: 12 },

  row: { flexDirection: 'row' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  inventoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eef1f5',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  inputLike: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputPlaceholder: { color: '#6b7280' },
  inputValue: { color: '#111827', fontWeight: '700' },

  qtyInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    backgroundColor: '#fff',
  },

  assignmentCard: {
    borderWidth: 1,
    borderColor: '#eef1f5',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  assignmentGrid: {
    gap: 8,
    marginBottom: 8,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { color: '#111827', fontSize: 12, fontWeight: '700' },

  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  ghostBtnText: { color: '#111827', fontWeight: '800' },
  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  modalCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#6b7280',
  },

  grid2: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  summarySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef1f5',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef1f5',
  },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  gradientBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  gradientBtnText: {
    fontWeight: "800",
    color: "#ffffff",
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});