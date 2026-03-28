// app/roles/cook/PrepTasks.tsx - Fixed version
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
import { Feather } from "@expo/vector-icons";
import { api } from "@/lib/api";

type PrepTask = {
  _id: string;
  cook: { _id: string; name: string };
  supervisor: { _id: string; name: string };
  items: Array<{
    foodItem: { _id: string; name: string };
    name: string;
    quantity: number;
    unit: string;
    completed: boolean;
    completedQuantity: number;
  }>;
  scheduledDate: string;
  scheduledTime: string;
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
};

export default function CookPrepTasks() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<PrepTask[]>([]);
  const [summary, setSummary] = useState({ assigned: 0, accepted: 0, preparing: 0, completed: 0 });
  const [selectedTask, setSelectedTask] = useState<PrepTask | null>(null);
  const [progressModal, setProgressModal] = useState(false);
  const [progressNotes, setProgressNotes] = useState("");
  const [itemProgress, setItemProgress] = useState<Record<string, number>>({});
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      console.log("📱 Fetching tasks for cook...");
      const res = await api.get("/api/prep-tasks/cook/tasks");
      console.log("📱 API Response:", res);
      
      if (res.ok) {
        setTasks(res.tasks || []);
        setSummary(res.summary || { assigned: 0, accepted: 0, preparing: 0, completed: 0 });
        console.log(`✅ Loaded ${res.tasks?.length || 0} tasks`);
        
        res.tasks?.forEach((task: PrepTask) => {
          const allItemsCompleted = task.items.every(item => item.completedQuantity >= item.quantity);
          console.log(`Task ${task._id}: Status = ${task.status}, All Items Completed = ${allItemsCompleted}`);
        });
      } else {
        console.error("Failed to fetch tasks:", res.error);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      Alert.alert("Error", "Failed to load tasks. Please pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks();
  }, [fetchTasks]);

  const handleAccept = useCallback(async (taskId: string) => {
    console.log("📱 Accepting task:", taskId);
    try {
      const res = await api.patch(`/api/prep-tasks/cook/${taskId}/accept`, {
        notes: "Task accepted, will start soon",
      });
      console.log("📱 Accept response:", res);
      
      if (res.ok) {
        Alert.alert("Success", "Task accepted! You can now start preparing.");
        await fetchTasks();
      } else {
        Alert.alert("Error", res.error || "Failed to accept task");
      }
    } catch (error: any) {
      console.error("Accept error:", error);
      Alert.alert("Error", error.message || "Network error");
    }
  }, [fetchTasks]);

  const handleStart = useCallback(async (taskId: string) => {
    const currentTask = tasks.find(t => t._id === taskId);
    if (!currentTask) {
      Alert.alert("Error", "Task not found");
      return;
    }
    
    console.log("📱 Starting task:", taskId, "Current status:", currentTask.status);
    
    if (currentTask.status !== "Accepted") {
      Alert.alert(
        "Cannot Start",
        `Task is currently "${currentTask.status}". You must accept it first.`,
        [
          { text: "OK" },
          ...(currentTask.status === "Assigned" ? [
            { 
              text: "Accept Task", 
              onPress: () => handleAccept(currentTask._id) 
            }
          ] : [])
        ]
      );
      return;
    }
    
    try {
      const res = await api.patch(`/api/prep-tasks/cook/${taskId}/start`, {
        notes: "Started preparation",
      });
      console.log("📱 Start response:", res);
      
      if (res.ok) {
        Alert.alert("Success", "Started preparing! You can now update progress and complete the task.");
        await fetchTasks();
      } else {
        Alert.alert("Error", res.error || "Failed to start task");
      }
    } catch (error: any) {
      console.error("Start error:", error);
      Alert.alert("Error", error.message);
    }
  }, [tasks, fetchTasks, handleAccept]);

  const handleComplete = useCallback(async (taskId: string) => {
    console.log("🔵 handleComplete called with taskId:", taskId);
    
    if (completingTaskId === taskId) {
      console.log("⚠️ Already completing this task, ignoring...");
      return;
    }
    
    const currentTask = tasks.find(t => t._id === taskId);
    if (!currentTask) {
      Alert.alert("Error", "Task not found");
      return;
    }
    
    console.log("📱 Completing task:", taskId);
    console.log("Task status:", currentTask.status);
    console.log("All items completed:", currentTask.items.every(item => item.completedQuantity >= item.quantity));
    
    const allItemsCompleted = currentTask.items.every(item => item.completedQuantity >= item.quantity);
    
    if (currentTask.status !== "Preparing") {
      Alert.alert(
        "Cannot Complete",
        `Task is currently "${currentTask.status}". You need to start preparing first.`,
        [
          { text: "OK" },
          ...(currentTask.status === "Accepted" ? [
            { 
              text: "Start Preparing", 
              onPress: () => handleStart(currentTask._id) 
            }
          ] : [])
        ]
      );
      return;
    }
    
    if (!allItemsCompleted) {
      const incompleteItems = currentTask.items
        .filter(item => item.completedQuantity < item.quantity)
        .map(item => `${item.name}: ${item.completedQuantity}/${item.quantity} ${item.unit}`);
      
      Alert.alert(
        "Cannot Complete",
        `Not all items are fully prepared:\n\n${incompleteItems.join("\n")}\n\nPlease update progress for these items first.`,
        [{ text: "OK" }]
      );
      return;
    }
    
    console.log("✅ All checks passed, showing confirmation dialog");
    
    Alert.alert(
      "Complete Task",
      "Are you sure all items are prepared and ready?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Complete",
          onPress: async () => {
            console.log("✅ User confirmed completion, sending API request...");
            setCompletingTaskId(taskId);
            try {
              const res = await api.patch(`/api/prep-tasks/cook/${taskId}/complete`, {
                notes: "Task completed successfully",
              });
              
              console.log("📡 API Response:", res);
              
              if (res.ok) {
                Alert.alert("Success", "Task completed successfully!");
                setTimeout(() => {
                  fetchTasks();
                }, 500);
              } else {
                let errorMessage = res.error || "Failed to complete task";
                if (res.status === 400) {
                  errorMessage = res.error || "Cannot complete task. Please ensure all items are prepared.";
                }
                Alert.alert("Error", errorMessage);
              }
            } catch (error: any) {
              console.error("Complete task error:", error);
              Alert.alert("Error", error.message || "Network error. Please try again.");
            } finally {
              setCompletingTaskId(null);
            }
          },
        },
      ]
    );
  }, [tasks, completingTaskId, fetchTasks, handleStart]);

  const debugComplete = useCallback(async (taskId: string) => {
    console.log("🐛 DEBUG: Testing complete endpoint for task:", taskId);
    try {
      const res = await api.patch(`/api/prep-tasks/cook/${taskId}/complete`, {
        notes: "Debug completion",
      });
      console.log("🐛 Debug response:", res);
      Alert.alert(
        "Debug", 
        `Status: ${res.status}\nOk: ${res.ok}\nMessage: ${res.message || res.error || 'No message'}`,
        [{ text: "OK" }]
      );
      if (res.ok) {
        await fetchTasks();
      }
    } catch (error: any) {
      console.error("🐛 Debug error:", error);
      Alert.alert("Debug Error", error.message || String(error));
    }
  }, [fetchTasks]);

  const handleUpdateProgress = useCallback(async () => {
    if (!selectedTask) return;

    const progressArray = Object.entries(itemProgress).map(([foodItemId, completedQuantity]) => ({
      foodItemId,
      completedQuantity,
    }));

    console.log("📱 Updating progress for task:", selectedTask._id);

    try {
      const res = await api.patch(`/api/prep-tasks/cook/${selectedTask._id}/progress`, {
        itemProgress: progressArray,
        notes: progressNotes,
      });
      
      console.log("📱 Progress update response:", res);
      
      if (res.ok) {
        Alert.alert("Success", "Progress updated");
        setProgressModal(false);
        await fetchTasks();
      } else {
        Alert.alert("Error", res.error || "Failed to update progress");
      }
    } catch (error: any) {
      console.error("Update progress error:", error);
      Alert.alert("Error", error.message);
    }
  }, [selectedTask, itemProgress, progressNotes, fetchTasks]);

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return "Overdue!";
    if (diffMins < 60) return `${diffMins}m left`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m left`;
    return `${Math.floor(diffMins / 1440)}d left`;
  };

  const getTaskProgress = (task: PrepTask) => {
    const total = task.items.reduce((sum, i) => sum + i.quantity, 0);
    const completed = task.items.reduce((sum, i) => sum + i.completedQuantity, 0);
    return total > 0 ? (completed / total) * 100 : 0;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const activeTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Prep Tasks</Text>
        <Text style={styles.subtitle}>Manage your kitchen preparation tasks</Text>
      </View>

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

      {activeTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No active tasks</Text>
        </View>
      ) : (
        activeTasks.map((task) => {
          const progress = getTaskProgress(task);
          const timeRemaining = getTimeRemaining(task.deadline);
          const isOverdue = timeRemaining === "Overdue!";
          const allItemsCompleted = task.items.every(item => item.completedQuantity >= item.quantity);
          const isCompleting = completingTaskId === task._id;
          
          return (
            <View key={task._id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View>
                  <Text style={styles.supervisorName}>
                    From: {task.supervisor.name}
                  </Text>
                  <Text style={styles.scheduleText}>
                    {task.scheduledTime} • Due {new Date(task.deadline).toLocaleTimeString()}
                  </Text>
                </View>
                {task.isUrgent && (
                  <View style={styles.urgentBadge}>
                    <Feather name="alert-triangle" size={12} color="#ef4444" />
                    <Text style={styles.urgentText}>URGENT</Text>
                  </View>
                )}
              </View>

              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, { 
                  color: task.status === "Assigned" ? "#f59e0b" : 
                         task.status === "Accepted" ? "#3b82f6" :
                         task.status === "Preparing" ? "#8b5cf6" : "#6b7280"
                }]}>
                  Status: {task.status}
                </Text>
                {task.status === "Preparing" && !allItemsCompleted && (
                  <Text style={styles.warningText}>
                    {task.items.filter(i => i.completedQuantity < i.quantity).length} items remaining
                  </Text>
                )}
                {task.status === "Preparing" && allItemsCompleted && (
                  <Text style={styles.successText}>
                    ✓ All items ready!
                  </Text>
                )}
              </View>

              <View style={styles.itemsList}>
                {task.items.map((item, idx) => {
                  const isFullyCompleted = item.completedQuantity >= item.quantity;
                  const percentage = (item.completedQuantity / item.quantity) * 100;
                  
                  return (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, isFullyCompleted && styles.completedItem]}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemQuantity}>
                          ({item.quantity} {item.unit})
                        </Text>
                      </View>
                      {task.status === "Preparing" && (
                        <View style={styles.itemProgressWrapper}>
                          <View style={styles.itemProgressBar}>
                            <View 
                              style={[
                                styles.itemProgressFill, 
                                { width: `${percentage}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.itemProgressText}>
                            {item.completedQuantity}/{item.quantity}
                          </Text>
                        </View>
                      )}
                      {task.status !== "Preparing" && item.completedQuantity > 0 && (
                        <Text style={styles.completedBadge}>
                          {item.completedQuantity}/{item.quantity} done
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {task.supervisorNotes ? (
                <View style={styles.notesBox}>
                  <Feather name="file-text" size={14} color="#6b7280" />
                  <Text style={styles.notesText}>{task.supervisorNotes}</Text>
                </View>
              ) : null}

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={[styles.progressText, isOverdue && styles.overdueText]}>
                  {timeRemaining}
                </Text>
              </View>

              {/* Action Buttons - FIXED: Removed the fragment and properly structured buttons */}
              <View style={styles.actionButtons}>
                {task.status === "Assigned" && (
                  <Pressable
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(task._id)}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Accept Task</Text>
                  </Pressable>
                )}

                {task.status === "Accepted" && (
                  <Pressable
                    style={[styles.actionButton, styles.startButton]}
                    onPress={() => handleStart(task._id)}
                  >
                    <Feather name="play" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Start Preparing</Text>
                  </Pressable>
                )}

                {task.status === "Preparing" && (
                  <>
                    <View style={styles.preparingActions}>
                      <Pressable
                        style={[styles.actionButton, styles.progressButton]}
                        onPress={() => {
                          setSelectedTask(task);
                          const initialProgress: Record<string, number> = {};
                          task.items.forEach(item => {
                            initialProgress[item.foodItem._id] = item.completedQuantity;
                          });
                          setItemProgress(initialProgress);
                          setProgressNotes(task.cookNotes || "");
                          setProgressModal(true);
                        }}
                      >
                        <Feather name="sliders" size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Update Progress</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.actionButton, 
                          styles.completeButton,
                          (!allItemsCompleted || isCompleting) && styles.disabledButton
                        ]}
                        onPress={() => {
                          console.log("🎯 Complete button pressed for task:", task._id);
                          handleComplete(task._id);
                        }}
                        disabled={!allItemsCompleted || isCompleting}
                      >
                        {isCompleting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name="check" size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Complete Task</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    {/* Debug button - will help identify if the issue is with the complete button */}
                    <Pressable
                      style={[styles.debugButton, { marginTop: 8 }]}
                      onPress={() => debugComplete(task._id)}
                    >
                      <Feather name="bug" size={14} color="#fff" />
                      <Text style={styles.debugButtonText}>Debug Complete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}

      {tasks.filter(t => t.status === "Completed").length > 0 && (
        <View style={styles.completedSection}>
          <Text style={styles.completedTitle}>Recently Completed</Text>
          {tasks.filter(t => t.status === "Completed").slice(0, 3).map(task => (
            <View key={task._id} style={styles.completedTask}>
              <Feather name="check-circle" size={16} color="#10b981" />
              <Text style={styles.completedTaskText}>
                {task.items.length} items completed
              </Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={progressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Progress</Text>
              <Pressable onPress={() => setProgressModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedTask?.items.map(item => {
                const currentProgress = itemProgress[item.foodItem._id] || 0;
                const percentage = (currentProgress / item.quantity) * 100;
                
                return (
                  <View key={item.foodItem._id} style={styles.progressItem}>
                    <View style={styles.progressItemHeader}>
                      <Text style={styles.progressItemName}>{item.name}</Text>
                      <Text style={styles.progressItemQuantity}>
                        {currentProgress}/{item.quantity} {item.unit}
                      </Text>
                    </View>
                    <View style={styles.progressItemControls}>
                      <Pressable
                        onPress={() => setItemProgress(prev => ({
                          ...prev,
                          [item.foodItem._id]: Math.max(0, (prev[item.foodItem._id] || 0) - 1)
                        }))}
                        style={styles.progressItemButton}
                      >
                        <Feather name="minus" size={20} color="#6b7280" />
                      </Pressable>
                      <View style={styles.progressItemSliderContainer}>
                        <View style={styles.progressItemSlider}>
                          <View style={[styles.progressItemSliderFill, { width: `${percentage}%` }]} />
                        </View>
                      </View>
                      <Pressable
                        onPress={() => setItemProgress(prev => ({
                          ...prev,
                          [item.foodItem._id]: Math.min(item.quantity, (prev[item.foodItem._id] || 0) + 1)
                        }))}
                        style={styles.progressItemButton}
                      >
                        <Feather name="plus" size={20} color="#6b7280" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <TextInput
                style={styles.notesInput}
                placeholder="Add notes about progress..."
                value={progressNotes}
                onChangeText={setProgressNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor="#9ca3af"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelModalButton} onPress={() => setProgressModal(false)}>
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.updateModalButton} onPress={handleUpdateProgress}>
                <Text style={styles.updateModalButtonText}>Update Progress</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
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
  emptyState: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 10,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  supervisorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  scheduleText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
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
  statusBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  warningText: {
    fontSize: 11,
    color: "#f59e0b",
    fontWeight: "500",
  },
  successText: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    gap: 4,
  },
  itemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemName: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  completedItem: {
    textDecorationLine: "line-through",
    color: "#9ca3af",
  },
  itemQuantity: {
    fontSize: 11,
    color: "#6b7280",
  },
  itemProgressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  itemProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    overflow: "hidden",
  },
  itemProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 2,
  },
  itemProgressText: {
    fontSize: 10,
    color: "#6b7280",
    minWidth: 35,
  },
  completedBadge: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "500",
    marginTop: 2,
  },
  notesBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    color: "#6b7280",
    flex: 1,
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
    backgroundColor: "#10b981",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  overdueText: {
    color: "#ef4444",
  },
  actionButtons: {
    flexDirection: "column",
    gap: 8,
  },
  preparingActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  acceptButton: {
    backgroundColor: "#f59e0b",
  },
  startButton: {
    backgroundColor: "#8b5cf6",
  },
  progressButton: {
    backgroundColor: "#3b82f6",
  },
  completeButton: {
    backgroundColor: "#10b981",
  },
  disabledButton: {
    backgroundColor: "#9ca3af",
    opacity: 0.6,
  },
  debugButton: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  completedSection: {
    marginTop: 8,
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  completedTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  completedTaskText: {
    fontSize: 13,
    color: "#374151",
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
    maxHeight: "80%",
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
  progressItem: {
    marginBottom: 20,
  },
  progressItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  progressItemQuantity: {
    fontSize: 12,
    color: "#6b7280",
  },
  progressItemControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressItemButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  progressItemSliderContainer: {
    flex: 1,
  },
  progressItemSlider: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressItemSliderFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginTop: 16,
    minHeight: 80,
    textAlignVertical: "top",
    color: "#111827",
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
  updateModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563eb",
  },
  updateModalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});