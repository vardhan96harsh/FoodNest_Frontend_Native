// rider/OrderEntryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';

const { width, height } = Dimensions.get('window');

interface FoodItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  availableQuantity: number;
  assignedQuantity: number;
  soldQuantity: number;
}

interface CartItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
}

interface StopInfo {
  _id: string;
  name: string;
  address: string;
  arrivedAt: string;
}

interface OrderEntryProps {
  assignmentId?: string;
  stopId?: string;
  stopName?: string;
  onComplete?: (order: any) => void;
  onBack?: () => void;
}

export default function OrderEntryScreen(props: OrderEntryProps) {
  // Get params from both props and URL params
  const urlParams = useLocalSearchParams();
  
  const assignmentId = props.assignmentId || urlParams.assignmentId as string;
  const stopId = props.stopId || urlParams.stopId as string;
  const stopName = props.stopName || urlParams.stopName as string;

  const [items, setItems] = useState<FoodItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'other'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [stopInfo, setStopInfo] = useState<StopInfo | null>(null);
  const [currentSales, setCurrentSales] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [tempQuantity, setTempQuantity] = useState(1);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('OrderEntryScreen mounted with:', { assignmentId, stopId, stopName });
    
    if (!assignmentId || !stopId) {
      console.error('Missing required params:', { assignmentId, stopId });
      setError('Missing assignment or stop information');
      setFetchingItems(false);
      return;
    }
    
    fetchAvailableItems();
  }, [assignmentId, stopId]);

  const fetchAvailableItems = async () => {
    if (!assignmentId || !stopId) {
      Alert.alert('Error', 'Missing assignment or stop information');
      return;
    }

    setFetchingItems(true);
    setError(null);
    
    try {
      const url = `/api/rider/assignments/${assignmentId}/stops/${stopId}/available-items`;
      console.log('Fetching items from:', url);
      
      const response = await api.get(url);
      console.log('Response:', response);

      if (response.ok) {
        setItems(response.items || []);
        setStopInfo(response.stopInfo);
        setCurrentSales(response.currentSales);
      } else {
        setError(response.error || 'Failed to fetch items');
        Alert.alert('Error', response.error || 'Failed to fetch available items');
      }
    } catch (error: any) {
      console.error('Error fetching items:', error);
      const errorMsg = error?.message || 'Network error. Please try again.';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setFetchingItems(false);
    }
  };

  const openQuantityModal = (item: FoodItem) => {
    setSelectedItem(item);
    setTempQuantity(1);
    setQuantityModalVisible(true);
  };

  const addToCart = () => {
    if (!selectedItem) return;
    if (tempQuantity <= 0 || tempQuantity > selectedItem.availableQuantity) {
      Alert.alert('Invalid Quantity', `Please enter quantity between 1 and ${selectedItem.availableQuantity}`);
      return;
    }

    const existingItem = cart.find(cartItem => cartItem._id === selectedItem._id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + tempQuantity;
      if (newQuantity > selectedItem.availableQuantity) {
        Alert.alert('Stock Limit', `Cannot add more than ${selectedItem.availableQuantity} items`);
        return;
      }
      setCart(cart.map(cartItem =>
        cartItem._id === selectedItem._id
          ? { ...cartItem, quantity: newQuantity }
          : cartItem
      ));
    } else {
      setCart([...cart, {
        _id: selectedItem._id,
        name: selectedItem.name,
        price: selectedItem.price,
        quantity: tempQuantity,
        maxQuantity: selectedItem.availableQuantity
      }]);
    }
    
    setQuantityModalVisible(false);
    setSelectedItem(null);
  };

  const updateCartItem = (itemId: string, newQuantity: number) => {
    const item = cart.find(cartItem => cartItem._id === itemId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else if (newQuantity <= item.maxQuantity) {
      setCart(cart.map(cartItem =>
        cartItem._id === itemId
          ? { ...cartItem, quantity: newQuantity }
          : cartItem
      ));
    } else {
      Alert.alert('Stock Limit', `Maximum ${item.maxQuantity} items available`);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item._id !== itemId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the order');
      return;
    }

    if (!assignmentId || !stopId) {
      Alert.alert('Error', 'Missing assignment or stop information');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        assignmentId,
        stopId,
        items: cart.map(item => ({
          foodItemId: item._id,
          quantity: item.quantity
        })),
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        notes: notes || undefined
      };

      console.log('Submitting order:', orderData);

      const response = await api.post('/api/rider/orders', orderData);
      
      if (response.ok) {
        // Clear cart and refresh
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        await fetchAvailableItems();
        
        Alert.alert(
          'Order Placed Successfully!',
          `Total: ${formatPrice(calculateTotal())}\nPayment: ${paymentMethod.toUpperCase()}`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (props.onComplete) {
                  props.onComplete(response.order);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to place order');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      Alert.alert('Error', error?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStop = async () => {
    if (cart.length > 0) {
      Alert.alert(
        'Pending Orders',
        'You have items in cart. Complete the order first?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete Order', onPress: handleSubmitOrder },
          { text: 'Complete Stop Anyway', onPress: completeStop }
        ]
      );
    } else {
      completeStop();
    }
  };

  const completeStop = async () => {
    if (!assignmentId || !stopId) return;
    
    try {
      const response = await api.post(`/api/rider/assignments/${assignmentId}/stops/${stopId}/complete`);
      
      if (response.ok) {
        Alert.alert('Success', 'Stop completed successfully!', [
          { text: 'OK', onPress: () => {
            if (props.onBack) {
              props.onBack();
            } else {
              router.back();
            }
          }}
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to complete stop');
      }
    } catch (error: any) {
      console.error('Complete stop error:', error);
      Alert.alert('Error', error?.message || 'Failed to complete stop');
    }
  };

  // Loading state
  if (fetchingItems) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Feather name="alert-circle" size={60} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAvailableItems}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButtonError} onPress={() => {
            if (props.onBack) props.onBack();
            else router.back();
          }}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (props.onBack) props.onBack();
              else router.back();
            }} 
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.stopName}>{stopName || 'Stop Name'}</Text>
            {stopInfo && (
              <Text style={styles.stopAddress}>{stopInfo.address}</Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>In Progress</Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Items Grid */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Available Items</Text>
            {items.length === 0 ? (
              <View style={styles.emptyItems}>
                <Text style={styles.emptyText}>No items available</Text>
              </View>
            ) : (
              <View style={styles.itemsGrid}>
                {items.map(item => (
                  <TouchableOpacity
                    key={item._id}
                    style={styles.itemCard}
                    onPress={() => openQuantityModal(item)}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                      <Text style={styles.itemStock}>
                        Stock: {item.availableQuantity}
                      </Text>
                      {item.description && (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.addButton}>
                      <Feather name="plus-circle" size={32} color="#4caf50" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Cart Section */}
          <View style={styles.cartSection}>
            <Text style={styles.sectionTitle}>Current Order</Text>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Feather name="shopping-cart" size={48} color="#ccc" />
                <Text style={styles.emptyCartText}>Cart is empty</Text>
                <Text style={styles.emptyCartSubtext}>Add items from above</Text>
              </View>
            ) : (
              <>
                {cart.map(item => (
                  <View key={item._id} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>
                        {formatPrice(item.price)} × {item.quantity}
                      </Text>
                      <Text style={styles.cartItemTotal}>
                        {formatPrice(item.price * item.quantity)}
                      </Text>
                    </View>
                    <View style={styles.cartItemActions}>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          onPress={() => updateCartItem(item._id, item.quantity - 1)}
                          style={styles.qtyButton}
                        >
                          <Feather name="minus" size={20} color="#666" />
                        </TouchableOpacity>
                        <Text style={styles.cartQty}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateCartItem(item._id, item.quantity + 1)}
                          style={styles.qtyButton}
                        >
                          <Feather name="plus" size={20} color="#666" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeFromCart(item._id)}
                        style={styles.removeButton}
                      >
                        <Feather name="trash-2" size={20} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={styles.orderSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>{formatPrice(calculateTotal())}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{formatPrice(calculateTotal())}</Text>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.customerSection}>
                  <TextInput
                    style={styles.input}
                    placeholder="Customer Name (optional)"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Customer Phone (optional)"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Payment Methods */}
                <View style={styles.paymentSection}>
                  <Text style={styles.paymentLabel}>Payment Method</Text>
                  <View style={styles.paymentOptions}>
                    {(['cash', 'card', 'upi', 'other'] as const).map(method => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentOption,
                          paymentMethod === method && styles.paymentOptionActive
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        <Feather
                          name={
                            method === 'cash' ? 'dollar-sign' :
                            method === 'card' ? 'credit-card' :
                            method === 'upi' ? 'smartphone' :
                            'more-horizontal'
                          }
                          size={20}
                          color={paymentMethod === method ? '#fff' : '#666'}
                        />
                        <Text style={[
                          styles.paymentText,
                          paymentMethod === method && styles.paymentTextActive
                        ]}>
                          {method.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmitOrder}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Place Order • {formatPrice(calculateTotal())}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Current Stop Sales Summary */}
          {currentSales && currentSales.totalItems > 0 && (
            <View style={styles.salesSummary}>
              <Text style={styles.salesSummaryTitle}>Today's Sales at this Stop</Text>
              <View style={styles.salesStats}>
                <View style={styles.statItem}>
                  <Feather name="box" size={20} color="#666" />
                  <Text style={styles.statText}>Items: {currentSales.totalItems}</Text>
                </View>
                <View style={styles.statItem}>
                  <Feather name="rupee" size={20} color="#666" />
                  <Text style={styles.statText}>Revenue: {formatPrice(currentSales.totalRevenue)}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Complete Stop Button */}
        <TouchableOpacity
          style={styles.completeStopButton}
          onPress={handleCompleteStop}
        >
          <Feather name="check-circle" size={24} color="#fff" />
          <Text style={styles.completeStopText}>Complete Stop</Text>
        </TouchableOpacity>

        {/* Quantity Modal */}
        <Modal
          visible={quantityModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setQuantityModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setQuantityModalVisible(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add to Cart</Text>
              {selectedItem && (
                <>
                  <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                  <Text style={styles.modalItemPrice}>
                    {formatPrice(selectedItem.price)} per item
                  </Text>
                  <Text style={styles.modalItemStock}>
                    Available: {selectedItem.availableQuantity}
                  </Text>
                  
                  <View style={styles.modalQuantityControls}>
                    <TouchableOpacity
                      onPress={() => setTempQuantity(Math.max(1, tempQuantity - 1))}
                      style={styles.modalQtyButton}
                    >
                      <Feather name="minus" size={24} color="#666" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.modalQuantityInput}
                      value={tempQuantity.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 1;
                        setTempQuantity(Math.min(selectedItem.availableQuantity, Math.max(1, num)));
                      }}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => setTempQuantity(Math.min(selectedItem.availableQuantity, tempQuantity + 1))}
                      style={styles.modalQtyButton}
                    >
                      <Feather name="plus" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalTotal}>
                    Total: {formatPrice(selectedItem.price * tempQuantity)}
                  </Text>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setQuantityModalVisible(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.addButtonModal]}
                      onPress={addToCart}
                    >
                      <Text style={styles.addButtonText}>Add to Cart</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButtonError: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stopAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  itemsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemsGrid: {
    flexDirection: 'column',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#e91e63',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  itemStock: {
    fontSize: 12,
    color: '#666',
  },
  itemDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  addButton: {
    marginLeft: 12,
  },
  emptyItems: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  cartSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyCart: {
    alignItems: 'center',
    padding: 32,
  },
  emptyCartText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyCartSubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e91e63',
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 8,
  },
  qtyButton: {
    padding: 4,
  },
  cartQty: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  orderSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e91e63',
  },
  customerSection: {
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentSection: {
    marginTop: 16,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 6,
  },
  paymentOptionActive: {
    backgroundColor: '#2196f3',
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  paymentTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#e91e63',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  salesSummary: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 80,
  },
  salesSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  salesStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  completeStopButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  completeStopText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalItemPrice: {
    fontSize: 16,
    color: '#e91e63',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalItemStock: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalQtyButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
  },
  modalQuantityInput: {
    width: 80,
    height: 44,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  modalTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e91e63',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  addButtonModal: {
    backgroundColor: '#4caf50',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});