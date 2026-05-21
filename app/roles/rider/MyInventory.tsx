// screens/MyInventory.tsx
import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, Image, Pressable, Alert, RefreshControl, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
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
};

type Assignment = {
  _id: string;
  route: {
    _id: string;
    name: string;
  };
  inventory: InventoryItem[];
  status: 'pending' | 'active' | 'completed';
  date: string;
};

/* ---------- helpers ---------- */
const tone = {
  primary: "#2563eb",
  success: "#059669",
  warning: "#d97706",
  destructive: "#dc2626",
  gray: "#6b7280",
} as const;

const getStatus = (remaining: number, assigned: number): "critical" | "low" | "good" => {
  const percentage = (remaining / assigned) * 100;
  if (percentage <= 20) return "critical";
  if (percentage <= 50) return "low";
  return "good";
};

const statusColor = (status: "critical" | "low" | "good") =>
  status === "critical" ? tone.destructive : status === "low" ? tone.warning : tone.success;

const progressPct = (sold: number, assigned: number) => (sold / Math.max(assigned, 1)) * 100;

/* ---------- Components ---------- */
function Badge({
  text,
  variant = "outline",
  color = "#2563eb",
}: { text: string; variant?: "solid" | "outline"; color?: string }) {
  const solid = variant === "solid";
  return (
    <View style={[
      styles.badge,
      { backgroundColor: solid ? color : "transparent", borderColor: color }
    ]}>
      <Text style={{ color: solid ? "#fff" : color, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.subtleSmall}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function MyInventoryScreen() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      setError(null);
      console.log("Fetching today's assignment for inventory...");
      const response = await api.get('/api/rider/assignments/today');

      if (response.ok && response.assignment) {
        setAssignment(response.assignment);
        console.log(`Loaded inventory with ${response.assignment.inventory?.length || 0} items`);
      } else {
        console.log("No assignment found for today");
        setAssignment(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch assignment:', err);
      setError(err?.message || 'Failed to load inventory');
      setAssignment(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssignment();
  }, [fetchAssignment]);

  // Calculate totals from real data
  const inventoryItems = assignment?.inventory || [];
  
  const totalRemainingValue = inventoryItems.reduce(
    (sum, item) => sum + (item.quantityRemaining * item.foodItem.price), 0
  );
  
  const totalSalesValue = inventoryItems.reduce(
    (sum, item) => sum + (item.quantitySold * item.foodItem.price), 0
  );
  
  const totalItemsLeft = inventoryItems.reduce(
    (sum, item) => sum + item.quantityRemaining, 0
  );
  
  const totalAssigned = inventoryItems.reduce(
    (sum, item) => sum + item.quantityAssigned, 0
  );
  
  const totalSold = inventoryItems.reduce(
    (sum, item) => sum + item.quantitySold, 0
  );

  const criticalItems = inventoryItems.filter(
    item => getStatus(item.quantityRemaining, item.quantityAssigned) === "critical"
  );
  
  const lowItems = inventoryItems.filter(
    item => getStatus(item.quantityRemaining, item.quantityAssigned) === "low"
  );

  const handleRequestMore = (itemName: string) => {
    Alert.alert(
      "Request More Stock",
      `Would you like to request more ${itemName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Request", 
          onPress: () => Alert.alert("Request Sent", `Request for more ${itemName} has been sent to admin`) 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color={tone.primary} />
        <Text style={{ marginTop: 12, color: tone.gray }}>Loading inventory...</Text>
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
          <Text style={styles.h1}>Error Loading Inventory</Text>
          <Text style={styles.subtle}>{error}</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={onRefresh}>
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!assignment || inventoryItems.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[styles.page, { flex: 1, justifyContent: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyState}>
          <Feather name="package" size={60} color={tone.gray} />
          <Text style={styles.h1}>No Inventory</Text>
          <Text style={styles.subtle}>
            {!assignment 
              ? "You don't have an active route today." 
              : "No items have been assigned to you yet."}
          </Text>
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
        <Text style={styles.h1}>My Inventory</Text>
        <Text style={styles.subtle}>
          {assignment.route?.name || 'Today\'s Route'} • {new Date(assignment.date).toLocaleDateString()}
        </Text>
      </View>

      {/* Top stats (3 cards) */}
      <View style={styles.statsRow}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Remaining Value</Text>
            <Feather name="package" size={16} color={tone.primary} />
          </View>
          <Text style={[styles.statBig, { color: tone.primary }]}>
            ₹{totalRemainingValue.toFixed(2)}
          </Text>
          <Text style={styles.subtleSmall}>Current inventory value</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sales Value</Text>
            <Feather name="trending-up" size={16} color={tone.success} />
          </View>
          <Text style={[styles.statBig, { color: tone.success }]}>
            ₹{totalSalesValue.toFixed(2)}
          </Text>
          <Text style={styles.subtleSmall}>Value of items sold</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Items Remaining</Text>
            <Feather name="archive" size={16} color={tone.primary} />
          </View>
          <Text style={styles.statBig}>{totalItemsLeft}</Text>
          <Text style={styles.subtleSmall}>Out of {totalAssigned} total</Text>
        </View>
      </View>

      {/* Item cards */}
      <View style={{ gap: 12 }}>
        {inventoryItems.map((item, index) => {
          const status = getStatus(item.quantityRemaining, item.quantityAssigned);
          const remainingValue = item.quantityRemaining * item.foodItem.price;
          
          return (
            <View key={item.foodItem._id || index} style={styles.card}>
              {/* Header row */}
              <View style={[styles.row, { alignItems: "center", gap: 12 }]}>
                <View style={styles.thumb}>
                  {item.foodItem.imageUrl ? (
                    <Image source={{ uri: item.foodItem.imageUrl }} style={{ width: "100%", height: "100%", borderRadius: 10 }} />
                  ) : (
                    <Feather name="image" size={20} color={tone.gray} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={[styles.rowBetween, { alignItems: "center" }]}>
                    <View>
                      <Text style={styles.itemTitle}>{item.foodItem.name}</Text>
                      <Text style={styles.subtleSmall}>₹{item.foodItem.price} each</Text>
                    </View>
                    <Badge
                      text={status}
                      variant="outline"
                      color={statusColor(status)}
                    />
                  </View>
                </View>
              </View>

              {/* Stats grid */}
              <View style={styles.itemStatsGrid}>
                <StatCell label="Assigned" value={`${item.quantityAssigned}`} />
                <StatCell label="Sold" value={`${item.quantitySold}`} valueColor={tone.success} />
                <StatCell label="Remaining" value={`${item.quantityRemaining}`} valueColor={tone.primary} />
              </View>

              {/* Progress */}
              <View style={{ marginTop: 8 }}>
                <View style={[styles.rowBetween, { marginBottom: 6 }]}>
                  <Text style={styles.subtleSmall}>Sales Progress</Text>
                  <Text style={styles.subtleSmall}>{Math.round(progressPct(item.quantitySold, item.quantityAssigned))}%</Text>
                </View>
                <ProgressBar value={progressPct(item.quantitySold, item.quantityAssigned)} />
              </View>

              {/* Values */}
              <View style={[styles.rowBetween, { marginTop: 10 }]}>
                <Text style={styles.subtleSmall}>Remaining Value</Text>
                <Text style={{ fontWeight: "700", color: "#111827" }}>
                  ₹{remainingValue.toFixed(2)}
                </Text>
              </View>

              {/* Request More */}
              {item.quantityRemaining <= Math.ceil(item.quantityAssigned * 0.2) && (
                <Pressable
                  onPress={() => handleRequestMore(item.foodItem.name)}
                  style={({ pressed }) => [styles.ghostBtn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
                >
                  <Feather name="plus" size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.ghostBtnText}>Request More Stock</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {/* Summary card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Inventory Summary</Text>
        <Text style={styles.subtle}>Overall inventory status & recommendations</Text>

        <View style={styles.summaryGrid}>
          {/* Critical Items */}
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Critical Items ({criticalItems.length})</Text>
            {criticalItems.length === 0 ? (
              <Text style={styles.subtleSmall}>None</Text>
            ) : (
              criticalItems.map((item) => (
                <View key={item.foodItem._id} style={[styles.summaryRow, { backgroundColor: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.25)" }]}>
                  <Text style={styles.summaryItem}>{item.foodItem.name}</Text>
                  <Badge text={`${item.quantityRemaining} left`} variant="solid" color={tone.destructive} />
                </View>
              ))
            )}
          </View>

          {/* Low Stock Items */}
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Low Stock Items ({lowItems.length})</Text>
            {lowItems.length === 0 ? (
              <Text style={styles.subtleSmall}>None</Text>
            ) : (
              lowItems.map((item) => (
                <View key={item.foodItem._id} style={[styles.summaryRow, { backgroundColor: "rgba(217,119,6,0.08)", borderColor: "rgba(217,119,6,0.25)" }]}>
                  <Text style={styles.summaryItem}>{item.foodItem.name}</Text>
                  <Badge text={`${item.quantityRemaining} left`} variant="solid" color={tone.warning} />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Performance Summary */}
        <View style={styles.performanceSummary}>
          <Text style={styles.summaryTitle}>Performance</Text>
          <View style={styles.performanceRow}>
            <Text style={styles.subtleSmall}>Total Items Sold:</Text>
            <Text style={styles.performanceValue}>{totalSold} / {totalAssigned}</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.subtleSmall}>Sales Rate:</Text>
            <Text style={[styles.performanceValue, { color: tone.success }]}>
              {Math.round((totalSold / totalAssigned) * 100)}%
            </Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.subtleSmall}>Total Revenue:</Text>
            <Text style={[styles.performanceValue, { color: tone.success }]}>
              ₹{totalSalesValue.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 32, backgroundColor: "#f9fafb" },

  h1: { fontSize: 22, fontWeight: "800", color: "#111827" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  subtle: { color: "#6b7280" },
  subtleSmall: { color: "#6b7280", fontSize: 12 },
  inr: { fontSize: 11, color: "#6b7280" },

  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },

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
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: "#374151" },

  /* top stats */
  statsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  statBig: { fontSize: 18, fontWeight: "800", color: "#111827" },

  /* item block */
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  itemTitle: { fontWeight: "800", color: "#111827", fontSize: 15 },
  itemStatsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },

  /* list / table look */
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "#f1f5f9", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: "#2563eb" },

  /* badge */
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },

  /* stat value (reused) */
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },

  /* summary */
  summaryGrid: { flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 6 },
  summaryRow: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryItem: { fontSize: 13, color: "#111827", fontWeight: "600" },
  performanceSummary: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef1f5",
  },
  performanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  performanceValue: {
    fontWeight: "700",
    color: "#111827",
    fontSize: 14,
  },

  /* ghost button */
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  ghostBtnText: { color: "#111827", fontWeight: "800", fontSize: 12 },
  
  /* primary button */
  primaryBtn: {
    backgroundColor: tone.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  /* empty state */
  emptyState: {
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
});