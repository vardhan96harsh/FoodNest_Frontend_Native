// app/roles/supervisor/PrepTasks.tsx
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
  FlatList,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";

type FoodItem = {
  _id: string;
  name: string;
  price: number;
  unit?: string;
  stock?: number;
};

type Cook = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
};

type PrepTask = {
  _id: string;
  cook: Cook;
  supervisor: { _id: string; name: string };
  items: Array<{
    foodItem: FoodItem;
    name: string;
    quantity: number;
    unit: string;
    completed: boolean;
    completedQuantity: number;
  }>;
  scheduledDate: string;
  scheduledTime: "Morning" | "Afternoon" | "Evening";
  deadline: string;
  priority: "High" | "Medium" | "Low";
  isUrgent: boolean;
  status: "Assigned" | "Accepted" | "Preparing" | "Completed" | "Cancelled";
  supervisorNotes?: string;
  cookNotes?: string;
  assignedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  history: Array<{
    status: string;
    updatedBy: { _id: string; name: string };
    updatedAt: string;
    notes?: string;
  }>;
};

type PrepTaskSummary = {
  assigned: number;
  accepted: number;
  preparing: number;
  completed: number;
  total: number;
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  Assigned: { label: "Assigned", color: "#f59e0b", icon: "clock" },
  Accepted: { label: "Accepted", color: "#3b82f6", icon: "check-circle" },
  Preparing: { label: "Preparing", color: "#8b5cf6", icon: "coffee" },
  Completed: { label: "Completed", color: "#10b981", icon: "check-circle" },
  Cancelled: { label: "Cancelled", color: "#ef4444", icon: "x-circle" },
};

const priorityColors = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#10b981",
};

export default function SupervisorPrepTasks() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<PrepTask[]>([]);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [summary, setSummary] = useState<PrepTaskSummary>({
    assigned: 0,
    accepted: 0,
    preparing: 0,
    completed: 0,
    total: 0,
  });
  
  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedCook, setSelectedCook] = useState<Cook | null>(null);
  const [selectedFoodItems, setSelectedFoodItems] = useState<Array<{ foodItemId: string; quantity: number }>>([]);
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [isUrgent, setIsUrgent] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState<"Morning" | "Afternoon" | "Evening">("Morning");
  const [supervisorNotes, setSupervisorNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track task modal
  const [trackModalVisible, setTrackModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PrepTask | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch prep tasks
      const tasksRes = await api.get("/api/prep-tasks/supervisor/tasks");
      if (tasksRes.ok) {
        setTasks(tasksRes.tasks || []);
        setSummary(tasksRes.summary || {
          assigned: 0,
          accepted: 0,
          preparing: 0,
          completed: 0,
          total: 0,
        });
        setCooks(tasksRes.cooks || []);
      } else {
        console.error("Failed to fetch tasks:", tasksRes);
      }
      
      // Fetch available food items for creation
      const foodsRes = await api.get("/api/foods");
      
      // Handle the foods response
      let foodsArray: FoodItem[] = [];
      
      if (foodsRes.ok) {
        if (Array.isArray(foodsRes.data)) {
          foodsArray = foodsRes.data;
        } else if (Array.isArray(foodsRes.foods)) {
          foodsArray = foodsRes.foods;
        } else if (Array.isArray(foodsRes.items)) {
          foodsArray = foodsRes.items;
        } else if (Array.isArray(foodsRes)) {
          foodsArray = foodsRes;
        }
      } else if (Array.isArray(foodsRes)) {
        foodsArray = foodsRes;
      }
      
      // Only log if there's a significant change or error
      if (foodsArray.length !== availableFoods.length) {
        console.log(`📦 Loaded ${foodsArray.length} food items`);
      }
      
      setAvailableFoods(foodsArray);
      
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [availableFoods.length]); // Added dependency to avoid unnecessary logs

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds instead of 30 to reduce logs
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleCreateTask = async () => {
    if (!selectedCook) {
      Alert.alert("Error", "Please select a cook");
      return;
    }
    if (selectedFoodItems.length === 0) {
      Alert.alert("Error", "Please add at least one food item");
      return;
    }

    try {
      const res = await api.post("/api/prep-tasks/supervisor/create", {
        cookId: selectedCook._id,
        items: selectedFoodItems,
        scheduledDate,
        scheduledTime,
        priority,
        isUrgent,
        supervisorNotes,
      });

      if (res.ok) {
        Alert.alert("Success", "Prep task created successfully");
        setCreateModalVisible(false);
        resetForm();
        fetchData();
      } else {
        Alert.alert("Error", res.error || "Failed to create task");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create task");
    }
  };

  const resetForm = () => {
    setSelectedCook(null);
    setSelectedFoodItems([]);
    setPriority("Medium");
    setIsUrgent(false);
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledTime("Morning");
    setSupervisorNotes("");
    setSearchQuery("");
  };

  const handleCancelTask = async (taskId: string) => {
    Alert.alert(
      "Cancel Task",
      "Are you sure you want to cancel this task?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.patch(`/api/prep-tasks/supervisor/${taskId}/cancel`, {
                reason: "Cancelled by supervisor",
              });
              if (res.ok) {
                Alert.alert("Success", "Task cancelled");
                fetchData();
              } else {
                Alert.alert("Error", res.error || "Failed to cancel task");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const addFoodItem = (food: FoodItem) => {
    const existing = selectedFoodItems.find(f => f.foodItemId === food._id);
    if (existing) {
      setSelectedFoodItems(prev =>
        prev.map(f =>
          f.foodItemId === food._id
            ? { ...f, quantity: f.quantity + 1 }
            : f
        )
      );
    } else {
      setSelectedFoodItems(prev => [...prev, { foodItemId: food._id, quantity: 1 }]);
    }
  };

  const removeFoodItem = (foodId: string) => {
    setSelectedFoodItems(prev => prev.filter(f => f.foodItemId !== foodId));
  };

  const updateQuantity = (foodId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFoodItem(foodId);
    } else {
      setSelectedFoodItems(prev =>
        prev.map(f =>
          f.foodItemId === foodId ? { ...f, quantity } : f
        )
      );
    }
  };

  const getTaskProgress = (task: PrepTask) => {
    const total = task.items.reduce((sum, item) => sum + item.quantity, 0);
    const completed = task.items.reduce((sum, item) => sum + item.completedQuantity, 0);
    return total > 0 ? (completed / total) * 100 : 0;
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return "Overdue";
    if (diffMins < 60) return `${diffMins} min remaining`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
    return `${Math.floor(diffMins / 1440)} days`;
  };

  // Filter foods based on search query
  const filteredFoods = availableFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Prep Tasks</Text>
          <Text style={styles.subtitle}>Manage kitchen preparation tasks</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setCreateModalVisible(true)}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.createButtonText}>New Task</Text>
        </Pressable>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: "#fef3c7" }]}>
          <Text style={[styles.summaryNumber, { color: "#f59e0b" }]}>{summary.assigned}</Text>
          <Text style={styles.summaryLabel}>Assigned</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#dbeafe" }]}>
          <Text style={[styles.summaryNumber, { color: "#3b82f6" }]}>{summary.accepted}</Text>
          <Text style={styles.summaryLabel}>Accepted</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#ede9fe" }]}>
          <Text style={[styles.summaryNumber, { color: "#8b5cf6" }]}>{summary.preparing}</Text>
          <Text style={styles.summaryLabel}>Preparing</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#d1fae5" }]}>
          <Text style={[styles.summaryNumber, { color: "#10b981" }]}>{summary.completed}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
      </View>

      {/* Tasks List */}
      {tasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled").map(task => {
        const config = statusConfig[task.status];
        const progress = getTaskProgress(task);
        const timeRemaining = getTimeRemaining(task.deadline);
        
        return (
          <Pressable
            key={task._id}
            style={styles.taskCard}
            onPress={() => {
              setSelectedTask(task);
              setTrackModalVisible(true);
            }}
          >
            <View style={styles.taskHeader}>
              <View style={styles.cookInfo}>
                <Feather name="user" size={14} color="#6b7280" />
                <Text style={styles.cookName}>{task.cook?.name || "Unknown Cook"}</Text>
              </View>
              {task.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Feather name="alert-triangle" size={12} color="#ef4444" />
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
            </View>

            <View style={styles.taskBody}>
              <View style={styles.itemsList}>
                {task.items.slice(0, 3).map((item, idx) => (
                  <Text key={idx} style={styles.itemText}>
                    • {item.name} ({item.quantity} {item.unit})
                    {item.completed && " ✓"}
                  </Text>
                ))}
                {task.items.length > 3 && (
                  <Text style={styles.moreItems}>+{task.items.length - 3} more items</Text>
                )}
              </View>

              <View style={styles.taskMeta}>
                <View style={[styles.priorityBadge, { backgroundColor: priorityColors[task.priority] }]}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Feather name="clock" size={12} color="#6b7280" />
                  <Text style={[styles.timeText, timeRemaining === "Overdue" && styles.overdueText]}>
                    {timeRemaining}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: config.color }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
              </View>

              <View style={styles.taskFooter}>
                <View style={styles.statusBadge}>
                  <Feather name={config.icon} size={12} color={config.color} />
                  <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                </View>
                {task.status !== "Completed" && task.status !== "Cancelled" && (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => handleCancelTask(task._id)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}

      {/* Create Task Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Prep Task</Text>
              <Pressable onPress={() => setCreateModalVisible(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Cook Selection */}
              <Text style={styles.inputLabel}>Select Cook *</Text>
              {cooks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No cooks available in your team</Text>
                </View>
              ) : (
                <FlatList
                  data={cooks}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.cooksList}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.cookChip,
                        selectedCook?._id === item._id && styles.cookChipSelected,
                      ]}
                      onPress={() => setSelectedCook(item)}
                    >
                      <Text
                        style={[
                          styles.cookChipText,
                          selectedCook?._id === item._id && styles.cookChipTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                  keyExtractor={item => item._id}
                />
              )}

              {/* Food Items Selection */}
              <Text style={styles.inputLabel}>Food Items *</Text>
              
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Feather name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search food items..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery !== "" && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Feather name="x" size={18} color="#9ca3af" />
                  </Pressable>
                )}
              </View>

              {/* Food Items Grid */}
              <View style={styles.foodGrid}>
                {filteredFoods.map((food) => {
                  const isSelected = selectedFoodItems.some(f => f.foodItemId === food._id);
                  const selectedItem = selectedFoodItems.find(f => f.foodItemId === food._id);
                  
                  return (
                    <Pressable
                      key={food._id}
                      style={[styles.foodCard, isSelected && styles.foodCardSelected]}
                      onPress={() => addFoodItem(food)}
                    >
                      <View style={styles.foodCardContent}>
                        <Text style={styles.foodCardName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={styles.foodCardPrice}>₹{food.price}</Text>
                        <Text style={styles.foodCardUnit}>{food.unit || "piece"}</Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedQuantity}>{selectedItem?.quantity || 0}</Text>
                          <Feather name="check" size={12} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Selected Items List */}
              {selectedFoodItems.length > 0 && (
                <View style={styles.selectedItemsSection}>
                  <Text style={styles.selectedItemsTitle}>Selected Items:</Text>
                  {selectedFoodItems.map(item => {
                    const food = availableFoods.find(f => f._id === item.foodItemId);
                    if (!food) return null;
                    return (
                      <View key={item.foodItemId} style={styles.selectedFoodItem}>
                        <View style={styles.foodInfo}>
                          <Text style={styles.foodName}>{food.name}</Text>
                          <Text style={styles.foodUnit}>{food.unit || "piece"}</Text>
                        </View>
                        <View style={styles.quantityControl}>
                          <Pressable
                            onPress={() => updateQuantity(item.foodItemId, item.quantity - 1)}
                            style={styles.quantityButton}
                          >
                            <Feather name="minus" size={16} color="#6b7280" />
                          </Pressable>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                          <Pressable
                            onPress={() => updateQuantity(item.foodItemId, item.quantity + 1)}
                            style={styles.quantityButton}
                          >
                            <Feather name="plus" size={16} color="#6b7280" />
                          </Pressable>
                        </View>
                        <Pressable onPress={() => removeFoodItem(item.foodItemId)}>
                          <Feather name="trash-2" size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Priority */}
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityOptions}>
                {["High", "Medium", "Low"].map(p => (
                  <Pressable
                    key={p}
                    style={[
                      styles.priorityOption,
                      priority === p && { backgroundColor: priorityColors[p as keyof typeof priorityColors] },
                    ]}
                    onPress={() => setPriority(p as "High" | "Medium" | "Low")}
                  >
                    <Text
                      style={[
                        styles.priorityOptionText,
                        priority === p && { color: "#fff" },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Urgent Toggle */}
              <Pressable style={styles.urgentToggle} onPress={() => setIsUrgent(!isUrgent)}>
                <Feather name={isUrgent ? "check-square" : "square"} size={20} color="#2563eb" />
                <Text style={styles.urgentToggleText}>Mark as Urgent</Text>
              </Pressable>

              {/* Schedule */}
              <Text style={styles.inputLabel}>Scheduled Date</Text>
              <TextInput
                style={styles.input}
                value={scheduledDate}
                onChangeText={setScheduledDate}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>Scheduled Time</Text>
              <View style={styles.timeOptions}>
                {["Morning", "Afternoon", "Evening"].map(t => (
                  <Pressable
                    key={t}
                    style={[styles.timeOption, scheduledTime === t && styles.timeOptionSelected]}
                    onPress={() => setScheduledTime(t as "Morning" | "Afternoon" | "Evening")}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        scheduledTime === t && styles.timeOptionTextSelected,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Notes */}
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={supervisorNotes}
                onChangeText={setSupervisorNotes}
                placeholder="Add any instructions for the cook..."
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelModalButton} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.createModalButton} onPress={handleCreateTask}>
                <Text style={styles.createModalButtonText}>Create Task</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Track Task Modal */}
      <Modal visible={trackModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { top: "10%", maxHeight: "85%" }]}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Task Details</Text>
                <Pressable onPress={() => setTrackModalVisible(false)}>
                  <Feather name="x" size={24} color="#6b7280" />
                </Pressable>
              </View>

              {selectedTask && (
                <>
                  {/* Status Timeline */}
                  <View style={styles.timeline}>
                    {["Assigned", "Accepted", "Preparing", "Completed"].map((status, idx) => {
                      const isCompleted = selectedTask.history?.some(h => h.status === status);
                      const currentStatus = selectedTask.status === status;
                      return (
                        <View key={status} style={styles.timelineStep}>
                          <View
                            style={[
                              styles.timelineDot,
                              isCompleted && styles.timelineDotCompleted,
                              currentStatus && styles.timelineDotCurrent,
                            ]}
                          />
                          {idx < 3 && <View style={styles.timelineLine} />}
                          <Text style={styles.timelineLabel}>{status}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Task Info */}
                  <Text style={styles.detailTitle}>Cook Information</Text>
                  <View style={styles.detailCard}>
                    <Text>Name: {selectedTask.cook?.name}</Text>
                    <Text>Email: {selectedTask.cook?.email}</Text>
                  </View>

                  <Text style={styles.detailTitle}>Items to Prepare</Text>
                  <View style={styles.detailCard}>
                    {selectedTask.items.map((item, idx) => (
                      <View key={idx} style={styles.itemProgress}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={styles.itemQuantityProgress}>
                          <Text style={styles.itemQuantity}>
                            {item.completedQuantity}/{item.quantity} {item.unit}
                          </Text>
                          {item.completed && <Feather name="check-circle" size={14} color="#10b981" />}
                        </View>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.detailTitle}>Time Tracking</Text>
                  <View style={styles.detailCard}>
                    <Text>Assigned: {new Date(selectedTask.assignedAt).toLocaleString()}</Text>
                    {selectedTask.acceptedAt && (
                      <Text>Accepted: {new Date(selectedTask.acceptedAt).toLocaleString()}</Text>
                    )}
                    {selectedTask.startedAt && (
                      <Text>Started: {new Date(selectedTask.startedAt).toLocaleString()}</Text>
                    )}
                    {selectedTask.completedAt && (
                      <Text>Completed: {new Date(selectedTask.completedAt).toLocaleString()}</Text>
                    )}
                    <Text>Deadline: {new Date(selectedTask.deadline).toLocaleString()}</Text>
                  </View>

                  <Text style={styles.detailTitle}>Notes</Text>
                  <View style={styles.detailCard}>
                    {selectedTask.supervisorNotes && (
                      <Text style={styles.noteText}>Supervisor: {selectedTask.supervisorNotes}</Text>
                    )}
                    {selectedTask.cookNotes && (
                      <Text style={styles.noteText}>Cook: {selectedTask.cookNotes}</Text>
                    )}
                  </View>

                  <Text style={styles.detailTitle}>Activity History</Text>
                  <View style={styles.detailCard}>
                    {selectedTask.history?.map((event, idx) => (
                      <View key={idx} style={styles.historyEntry}>
                        <Text style={styles.historyStatus}>{event.status}</Text>
                        <Text style={styles.historyTime}>
                          {new Date(event.updatedAt).toLocaleString()}
                        </Text>
                        {event.notes && <Text style={styles.historyNotes}>{event.notes}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ... (keep all existing styles)
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  createButton: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    gap: 8,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cookInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cookName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  urgentBadge: {
    flexDirection: "row",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ef4444",
  },
  taskBody: {
    padding: 12,
    gap: 10,
  },
  itemsList: {
    gap: 4,
  },
  itemText: {
    fontSize: 13,
    color: "#374151",
  },
  moreItems: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  taskMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  overdueText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  taskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  cancelButtonText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  cooksList: {
    marginBottom: 12,
  },
  cookChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  cookChipSelected: {
    backgroundColor: "#2563eb",
  },
  cookChipText: {
    fontSize: 14,
    color: "#374151",
  },
  cookChipTextSelected: {
    color: "#fff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: "#111827",
  },
  foodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  foodCard: {
    width: "31%",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    position: "relative",
  },
  foodCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  foodCardContent: {
    alignItems: "center",
  },
  foodCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  foodCardPrice: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    marginBottom: 2,
  },
  foodCardUnit: {
    fontSize: 10,
    color: "#6b7280",
  },
  selectedBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 2,
  },
  selectedQuantity: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  selectedItemsSection: {
    marginBottom: 16,
  },
  selectedItemsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  selectedFoodItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 8,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  foodUnit: {
    fontSize: 11,
    color: "#6b7280",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 12,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  priorityOptions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  urgentToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  urgentToggleText: {
    fontSize: 14,
    color: "#374151",
  },
  timeOptions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  timeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  timeOptionSelected: {
    backgroundColor: "#2563eb",
  },
  timeOptionText: {
    fontSize: 14,
    color: "#374151",
  },
  timeOptionTextSelected: {
    color: "#fff",
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelModalButtonText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  createModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563eb",
  },
  createModalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 16,
  },
  timelineStep: {
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    marginBottom: 8,
  },
  timelineDotCompleted: {
    backgroundColor: "#10b981",
  },
  timelineDotCurrent: {
    backgroundColor: "#2563eb",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#bfdbfe",
  },
  timelineLine: {
    position: "absolute",
    top: 5,
    left: "50%",
    right: "-50%",
    height: 2,
    backgroundColor: "#e5e7eb",
  },
  timelineLabel: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  detailCard: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  itemProgress: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 13,
    color: "#374151",
  },
  itemQuantityProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#6b7280",
  },
  noteText: {
    fontSize: 13,
    color: "#374151",
    paddingVertical: 4,
  },
  historyEntry: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
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