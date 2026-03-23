import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { signOut } from '@/lib/authStore';
import { api } from '@/lib/api';

// ============================================================================
// TYPES
// ============================================================================

type Stop = {
  name: string;
  stopName?: string;
  lat?: number;
  lng?: number;
  status?: string;
  _id?: string;
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  joinedAt?: string;
  lastActive?: string;
  phone?: string;
  employeeId?: string;
};

type Member = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  status?: 'Active' | 'Inactive' | 'On Leave';
  phone?: string;
};

type Vehicle = {
  _id: string;
  registrationNo: string;
  type: 'Bike' | 'Cart' | 'Van' | 'Other';
  status: 'Available' | 'In Use' | 'Maintenance';
  lastMaintenance?: string;
};

type Battery = {
  _id: string;
  imei: string;
  type: 'Lithium' | 'Lead Acid';
  capacity: number;
  charge: number;
  health: number;
  status: 'Good' | 'Fair' | 'Poor';
};

type Route = {
  _id: string;
  name: string;
  region: string;
  status: 'Active' | 'Inactive';
  stops?: Stop[] | string[];
  stopsCount?: number;
  distance?: number;
  estimatedTime?: number;
};

type Team = {
  id: string;
  name: string;
  createdAt: string;
  supervisors: Member[];
  riders: Member[];
  cooks: Member[];
  refillCoordinators: Member[];
  vehicles: Vehicle[];
  batteries: Battery[];
  routes: Route[];
  metrics?: {
    totalMembers: number;
    activeAssignments: number;
    availableVehicles: number;
    availableBatteries: number;
  };
};

type TeamResponse = {
  ok: boolean;
  team: Team;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Not available';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString(undefined, options);
  } catch {
    return 'Invalid date';
  }
};

const getRelativeTime = (dateString?: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return formatDate(dateString);
  } catch {
    return '';
  }
};

// Helper to format stops for display
const formatStops = (stops?: Stop[] | string[]): string => {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return 'No stops';
  }

  try {
    // Get first 2 stops for preview
    const previewStops = stops.slice(0, 2).map(stop => {
      if (typeof stop === 'object') {
        return stop.name || stop.stopName || 'Stop';
      }
      return String(stop);
    });

    const preview = previewStops.join(' → ');
    
    if (stops.length > 2) {
      return `${preview} +${stops.length - 2} more`;
    }
    
    return preview;
  } catch (error) {
    return `${stops.length} stops`;
  }
};

// Get stop count
const getStopCount = (stops?: Stop[] | string[]): number => {
  if (!stops || !Array.isArray(stops)) return 0;
  return stops.length;
};

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

const StatCard = ({ icon, label, value, color }: any) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Feather name={icon} size={20} color={color} />
    <View style={styles.statContent}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

// ============================================================================
// STOPS LIST COMPONENT
// ============================================================================

const StopsList = ({ stops }: { stops?: Stop[] | string[] }) => {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return (
      <View style={styles.stopsContainer}>
        <Text style={styles.noStopsText}>No stops defined for this route</Text>
      </View>
    );
  }

  return (
    <View style={styles.stopsContainer}>
      <View style={styles.stopsHeader}>
        <Feather name="map-pin" size={12} color="#8b5cf6" />
        <Text style={styles.stopsTitle}>Route Stops ({stops.length})</Text>
      </View>
      
      {stops.map((stop, index) => {
        // Handle both object and string formats
        let stopName = '';
        let stopStatus = '';
        
        if (typeof stop === 'object' && stop !== null) {
          stopName = stop.name || stop.stopName || `Stop ${index + 1}`;
          stopStatus = stop.status || '';
        } else {
          stopName = String(stop || `Stop ${index + 1}`);
        }
        
        const isLast = index === stops.length - 1;
        
        return (
          <View key={index} style={styles.stopItem}>
            <View style={styles.stopDot} />
            <View style={styles.stopContent}>
              <Text style={styles.stopName} numberOfLines={1}>
                {stopName}
              </Text>
              {stopStatus ? (
                <View style={[styles.stopStatus, { 
                  backgroundColor: stopStatus === 'completed' ? '#10b98120' : 
                                  stopStatus === 'in-progress' ? '#f59e0b20' : '#f3f4f6'
                }]}>
                  <Text style={[styles.stopStatusText, { 
                    color: stopStatus === 'completed' ? '#10b981' : 
                           stopStatus === 'in-progress' ? '#f59e0b' : '#6b7280'
                  }]}>
                    {stopStatus}
                  </Text>
                </View>
              ) : null}
            </View>
            {!isLast && <View style={styles.stopConnector} />}
          </View>
        );
      })}
    </View>
  );
};

// ============================================================================
// MEMBER CARD COMPONENT
// ============================================================================

const MemberCard = ({ member, role, color }: { member: Member; role: string; color: string }) => (
  <View style={styles.memberCard}>
    <LinearGradient
      colors={[color, color + 'aa']}
      style={styles.memberAvatar}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.memberInitials}>
        {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
      </Text>
    </LinearGradient>
    <View style={styles.memberInfo}>
      <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
      <Text style={styles.memberRole}>{role}</Text>
      <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
    </View>
    <View style={[styles.statusBadge, { backgroundColor: member.status === 'Active' ? '#10b981' : '#f59e0b' }]}>
      <Text style={styles.statusText}>{member.status || 'Active'}</Text>
    </View>
  </View>
);

// ============================================================================
// RESOURCE CARD COMPONENT
// ============================================================================

const ResourceCard = ({ item, type }: { item: any; type: 'vehicle' | 'battery' | 'route' }) => {
  const getIcon = () => {
    switch (type) {
      case 'vehicle': return 'truck';
      case 'battery': return 'battery';
      case 'route': return 'map';
      default: return 'box';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'vehicle': return '#0284c7';
      case 'battery': return '#6b7280';
      case 'route': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.resourceCard}>
      <View style={[styles.resourceIcon, { backgroundColor: getColor() + '20' }]}>
        <Feather name={getIcon()} size={20} color={getColor()} />
      </View>
      <View style={styles.resourceInfo}>
        <Text style={styles.resourceTitle}>
          {type === 'vehicle' ? (item.registrationNo || 'Unknown Vehicle') :
           type === 'battery' ? `Battery ${item.imei?.slice(-6) || 'N/A'}` :
           item.name || 'Unknown Route'}
        </Text>
        <Text style={styles.resourceSubtitle}>
          {type === 'vehicle' && `${item.type || 'Vehicle'} • ${item.status || 'Unknown'}`}
          {type === 'battery' && `${item.type || 'Battery'} • ${item.charge || 0}% • ${item.health || 0}% health`}
          {type === 'route' && (
            <>
              {item.region || 'No region'} • {getStopCount(item.stops)} stops • {item.status || 'Active'}
              {'\n'}
              <Text style={styles.routeStops}>
                📍 {formatStops(item.stops)}
              </Text>
            </>
          )}
        </Text>
      </View>
      <View style={[styles.resourceStatus, { 
        backgroundColor: 
          item.status === 'Available' || item.status === 'Active' ? '#10b98120' :
          item.status === 'In Use' ? '#f59e0b20' : 
          item.status === 'Maintenance' ? '#ef444420' : '#f3f4f6'
      }]}>
        <Text style={[styles.resourceStatusText, { 
          color: 
            item.status === 'Available' || item.status === 'Active' ? '#10b981' :
            item.status === 'In Use' ? '#f59e0b' : 
            item.status === 'Maintenance' ? '#ef4444' : '#6b7280'
        }]}>
          {item.status || (type === 'battery' ? 'Available' : 'Active')}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  // User state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Team state
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  // ==========================================================================
  // FETCH USER DATA
  // ==========================================================================
  
  const fetchUserData = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        const userData = JSON.parse(raw);
        setUser({
          _id: userData._id || userData.id,
          name: userData.name || userData.email?.split('@')[0] || 'User',
          email: userData.email || '',
          role: userData.role || 'Supervisor',
          joinedAt: userData.createdAt || userData.joinedAt,
          lastActive: userData.lastActive,
          phone: userData.phone,
          employeeId: userData.employeeId,
        });
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // FETCH TEAM DETAILS
  // ==========================================================================
  
  const fetchTeamDetails = async (showLoading = true) => {
    if (!user || (user.role !== 'Supervisor' && user.role !== 'supervisor')) return;
    
    if (showLoading) setTeamLoading(true);
    setTeamError(null);
    
    try {
      const response = await api.get('/api/supervisor/my-team') as TeamResponse;
      
      if (response?.ok && response?.team) {
        // Calculate team metrics
        const teamData = response.team;
        teamData.metrics = {
          totalMembers: (teamData.supervisors?.length || 0) + 
                        (teamData.riders?.length || 0) + 
                        (teamData.cooks?.length || 0) + 
                        (teamData.refillCoordinators?.length || 0),
          activeAssignments: teamData.riders?.filter(r => r.status === 'Active').length || 0,
          availableVehicles: teamData.vehicles?.filter(v => v.status === 'Available').length || 0,
          availableBatteries: teamData.batteries?.filter(b => b.charge > 20).length || 0,
        };
        setTeam(teamData);
      } else {
        setTeamError('No team assigned yet');
      }
    } catch (error: any) {
      console.error('Error fetching team:', error);
      setTeamError(error?.message || 'Failed to load team details');
    } finally {
      if (showLoading) setTeamLoading(false);
      setRefreshing(false);
    }
  };

  // ==========================================================================
  // INITIAL LOAD
  // ==========================================================================
  
  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTeamDetails();
    }
  }, [user]);

  // ==========================================================================
  // REFRESH HANDLER
  // ==========================================================================
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    await fetchTeamDetails(false);
  }, [user]);

  // ==========================================================================
  // HEADER CONFIGURATION
  // ==========================================================================
  
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Profile',
      headerLeft: () => (
        <Pressable
          onPress={() => router.replace('/roles/supervisor/SupervisorOverview')}
          style={styles.backButton}
          accessibilityLabel="Back to overview"
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={onRefresh}
          style={styles.refreshButton}
          accessibilityLabel="Refresh"
        >
          <Feather name="refresh-cw" size={20} color="#6b7280" />
        </Pressable>
      ),
    });
  }, [navigation, router, onRefresh]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    const parts = user.name.trim().split(/\s+/);
    const a = parts[0]?.[0] || 'U';
    const b = parts[1]?.[0] || '';
    return (a + b).toUpperCase();
  }, [user?.name]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoute(expandedRoute === routeId ? null : routeId);
  };

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================
  
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFA000" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ===== PROFILE HEADER ===== */}
      <LinearGradient
        colors={['#FFC107', '#FFA000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <View style={styles.profileHeaderContent}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <View style={styles.profileRole}>
              <Feather name="shield" size={14} color="#fff" />
              <Text style={styles.profileRoleText}>{user?.role}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ===== USER DETAILS CARD ===== */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Feather name="mail" size={18} color="#6b7280" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{user?.email || 'Not provided'}</Text>
          </View>
        </View>
        
        {user?.phone && (
          <View style={styles.detailRow}>
            <Feather name="phone" size={18} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user.phone}</Text>
            </View>
          </View>
        )}
        
        {user?.employeeId && (
          <View style={styles.detailRow}>
            <Feather name="hash" size={18} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Employee ID</Text>
              <Text style={styles.detailValue}>{user.employeeId}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Feather name="calendar" size={18} color="#6b7280" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Joined</Text>
            <Text style={styles.detailValue}>{formatDate(user?.joinedAt)}</Text>
          </View>
        </View>
        
        {user?.lastActive && (
          <View style={styles.detailRow}>
            <Feather name="clock" size={18} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Last Active</Text>
              <Text style={styles.detailValue}>{getRelativeTime(user.lastActive)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ===== TEAM SECTION (SUPERVISOR ONLY) ===== */}
      {(user?.role === 'Supervisor' || user?.role === 'supervisor') && (
        <View style={styles.teamSection}>
          <View style={styles.sectionHeader}>
            <Feather name="users" size={22} color="#111827" />
            <Text style={styles.sectionTitle}>My Team</Text>
            {team && (
              <View style={styles.teamBadge}>
                <Text style={styles.teamBadgeText}>{team.name}</Text>
              </View>
            )}
          </View>

          {teamLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FFA000" />
              <Text style={styles.loadingText}>Loading team details...</Text>
            </View>
          ) : teamError ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={32} color="#ef4444" />
              <Text style={styles.errorTitle}>Unable to load team</Text>
              <Text style={styles.errorMessage}>{teamError}</Text>
              <Pressable 
                style={styles.retryButton}
                onPress={() => fetchTeamDetails()}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : team ? (
            <>
              {/* Team Metrics */}
              <View style={styles.metricsGrid}>
                <StatCard 
                  icon="users" 
                  label="Members" 
                  value={team.metrics?.totalMembers || 0}
                  color="#1d4ed8"
                />
                <StatCard 
                  icon="activity" 
                  label="Active" 
                  value={team.metrics?.activeAssignments || 0}
                  color="#10b981"
                />
                <StatCard 
                  icon="truck" 
                  label="Vehicles" 
                  value={team.metrics?.availableVehicles || 0}
                  color="#0284c7"
                />
                <StatCard 
                  icon="battery" 
                  label="Batteries" 
                  value={team.metrics?.availableBatteries || 0}
                  color="#6b7280"
                />
              </View>

              {/* Team Members Sections */}
              {team.supervisors && team.supervisors.length > 0 && (
                <View style={styles.memberSection}>
                  <View style={styles.memberSectionHeader}>
                    <Feather name="user-check" size={18} color="#1d4ed8" />
                    <Text style={styles.memberSectionTitle}>Supervisors</Text>
                    <Text style={styles.memberCount}>({team.supervisors.length})</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
                    {team.supervisors.map(member => (
                      <MemberCard 
                        key={member._id} 
                        member={member} 
                        role="Supervisor"
                        color="#1d4ed8"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {team.riders && team.riders.length > 0 && (
                <View style={styles.memberSection}>
                  <View style={styles.memberSectionHeader}>
                    <Feather name="truck" size={18} color="#047857" />
                    <Text style={styles.memberSectionTitle}>Riders</Text>
                    <Text style={styles.memberCount}>({team.riders.length})</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
                    {team.riders.map(member => (
                      <MemberCard 
                        key={member._id} 
                        member={member} 
                        role="Rider"
                        color="#047857"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {team.cooks && team.cooks.length > 0 && (
                <View style={styles.memberSection}>
                  <View style={styles.memberSectionHeader}>
                    <Feather name="coffee" size={18} color="#c2410c" />
                    <Text style={styles.memberSectionTitle}>Cooks</Text>
                    <Text style={styles.memberCount}>({team.cooks.length})</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
                    {team.cooks.map(member => (
                      <MemberCard 
                        key={member._id} 
                        member={member} 
                        role="Cook"
                        color="#c2410c"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {team.refillCoordinators && team.refillCoordinators.length > 0 && (
                <View style={styles.memberSection}>
                  <View style={styles.memberSectionHeader}>
                    <Feather name="refresh-cw" size={18} color="#7c3aed" />
                    <Text style={styles.memberSectionTitle}>Refill Coordinators</Text>
                    <Text style={styles.memberCount}>({team.refillCoordinators.length})</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
                    {team.refillCoordinators.map(member => (
                      <MemberCard 
                        key={member._id} 
                        member={member} 
                        role="Refill Coordinator"
                        color="#7c3aed"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Resources Sections */}
              {team.vehicles && team.vehicles.length > 0 && (
                <View style={styles.resourceSection}>
                  <View style={styles.resourceSectionHeader}>
                    <Feather name="truck" size={18} color="#0284c7" />
                    <Text style={styles.resourceSectionTitle}>Vehicles</Text>
                    <Text style={styles.resourceCount}>({team.vehicles.length})</Text>
                  </View>
                  {team.vehicles.map(vehicle => (
                    <ResourceCard key={vehicle._id} item={vehicle} type="vehicle" />
                  ))}
                </View>
              )}

              {team.batteries && team.batteries.length > 0 && (
                <View style={styles.resourceSection}>
                  <View style={styles.resourceSectionHeader}>
                    <Feather name="battery" size={18} color="#6b7280" />
                    <Text style={styles.resourceSectionTitle}>Batteries</Text>
                    <Text style={styles.resourceCount}>({team.batteries.length})</Text>
                  </View>
                  {team.batteries.map(battery => (
                    <ResourceCard key={battery._id} item={battery} type="battery" />
                  ))}
                </View>
              )}

              {/* Routes Section with Stops */}
              {team.routes && team.routes.length > 0 && (
                <View style={styles.resourceSection}>
                  <View style={styles.resourceSectionHeader}>
                    <Feather name="map" size={18} color="#8b5cf6" />
                    <Text style={styles.resourceSectionTitle}>Routes</Text>
                    <Text style={styles.resourceCount}>({team.routes.length})</Text>
                  </View>
                  
                  {team.routes.map(route => (
                    <View key={route._id}>
                      <Pressable 
                        onPress={() => toggleRouteExpansion(route._id)}
                        style={({ pressed }) => [
                          styles.routeHeader,
                          pressed && styles.routeHeaderPressed
                        ]}
                      >
                        <ResourceCard item={route} type="route" />
                        <Feather 
                          name={expandedRoute === route._id ? "chevron-up" : "chevron-down"} 
                          size={18} 
                          color="#6b7280" 
                          style={styles.expandIcon}
                        />
                      </Pressable>
                      
                      {expandedRoute === route._id && (
                        <StopsList stops={route.stops} />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </View>
      )}

      {/* ===== ABOUT SECTION ===== */}
      <View style={styles.aboutCard}>
        <View style={styles.aboutHeader}>
          <Feather name="info" size={18} color="#6b7280" />
          <Text style={styles.aboutTitle}>About</Text>
        </View>
        <Text style={styles.aboutText}>
          You are logged in as {user?.name} with the role of {user?.role}. 
          {user?.role === 'Supervisor' || user?.role === 'supervisor' 
            ? ' You have access to team management, assignment creation, and real-time tracking of your team\'s activities.'
            : ' Your access level determines what features and data you can view and manage.'}
        </Text>
        
        <View style={styles.helpLinks}>
          <Pressable style={styles.helpLink}>
            <Feather name="help-circle" size={16} color="#6b7280" />
            <Text style={styles.helpLinkText}>Help Center</Text>
          </Pressable>
          <Pressable style={styles.helpLink}>
            <Feather name="file-text" size={16} color="#6b7280" />
            <Text style={styles.helpLinkText}>Documentation</Text>
          </Pressable>
          <Pressable style={styles.helpLink}>
            <Feather name="message-circle" size={16} color="#6b7280" />
            <Text style={styles.helpLinkText}>Contact Support</Text>
          </Pressable>
        </View>
      </View>

      {/* ===== SIGN OUT BUTTON ===== */}
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed
        ]}
      >
        <Feather name="log-out" size={18} color="#fff" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.versionText}>Version 1.0.0</Text>
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  backButton: {
    marginLeft: 16,
    padding: 4,
  },
  refreshButton: {
    marginRight: 16,
    padding: 4,
  },
  
  // Profile Header
  profileHeader: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInitials: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileRoleText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },

  // Team Section
  teamSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  teamBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  teamBadgeText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },

  // Member Sections
  memberSection: {
    marginBottom: 20,
  },
  memberSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  memberCount: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 4,
  },
  memberScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  memberCard: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    marginLeft: 10,
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 10,
    color: '#9ca3af',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },

  // Resource Sections
  resourceSection: {
    marginBottom: 20,
  },
  resourceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  resourceSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  resourceCount: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 4,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flex: 1,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  resourceSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  resourceStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  resourceStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  routeStops: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  routeHeaderPressed: {
    opacity: 0.7,
  },
  expandIcon: {
    padding: 8,
    position: 'absolute',
    right: 0,
    top: 20,
  },

  // Stops Styles
  stopsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 52, // Align with resource card content
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  stopsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    position: 'relative',
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b5cf6',
    marginTop: 4,
    marginRight: 8,
  },
  stopContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopName: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  stopStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stopStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  stopConnector: {
    position: 'absolute',
    left: 3,
    top: 16,
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
  },
  noStopsText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    padding: 8,
    textAlign: 'center',
  },

  // Error Card
  errorCard: {
    alignItems: 'center',
    padding: 30,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },

  // About Card
  aboutCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  aboutText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  helpLinks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  helpLink: {
    alignItems: 'center',
    gap: 4,
  },
  helpLinkText: {
    fontSize: 11,
    color: '#6b7280',
  },

  // Sign Out Button
  signOutButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 20,
  },
});