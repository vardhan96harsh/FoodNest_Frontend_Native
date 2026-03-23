import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { signOut } from '@/lib/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [name, setName] = useState<string>('User');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('Rider'); // default; will be overridden if present
  const [joined, setJoined] = useState<string>('—');

  useEffect(() => {
  (async () => {
    try {
      // Try auth.user first (set by signInWithToken — works for both Google and manual login)
      const raw = await AsyncStorage.getItem("auth.user") 
                  || await AsyncStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        setName(u?.name || u?.email || "User");
        setEmail(u?.email || "");
        setRole(u?.role || "Rider");
        setJoined(u?.createdAt ? new Date(u.createdAt).toDateString() : "—");
      }
    } catch {
      // ignore
    }
  })();
}, []);

  // ⬅️ Back arrow in header → Rider Overview
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Profile',
      headerLeft: () => (
        <Pressable
          onPress={() => router.replace('/roles/rider/RiderOverview')}
          style={{ marginLeft: 12 }}
          accessibilityLabel="Back to overview"
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  const initials = useMemo(() => {
    const parts = (name || 'User').trim().split(/\s+/);
    const a = parts[0]?.[0] || 'U';
    const b = parts[1]?.[0] || '';
    return (a + b).toUpperCase();
  }, [name]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LinearGradient
        colors={['#FFC107', '#FFA000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bigAvatar}
      >
        <Text style={styles.bigAvatarText}>{initials}</Text>
      </LinearGradient>

      <Text style={styles.title}>Welcome, {name}</Text>
      <Text style={styles.subtitle}>{role}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Feather name="mail" size={18} color="#6b7280" />
          <Text style={styles.rowText}>{email || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Feather name="shield" size={18} color="#6b7280" />
          <Text style={styles.rowText}>{role}</Text>
        </View>
        <View style={styles.row}>
          <Feather name="calendar" size={18} color="#6b7280" />
          <Text style={styles.rowText}>Joined: {joined}</Text>
        </View>
      </View>

      {/* Any other details you want */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.sectionText}>
          You are logged in as a {role}. From here you can manage users, items, routes, teams,
          vehicles, and view analytics.
        </Text>
      </View>

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]}
        accessibilityLabel="Sign out"
      >
        <Feather name="log-out" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  bigAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    marginBottom: 12,
  },
  bigAvatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 18,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rowText: {
    fontSize: 15,
    color: '#111827',
  },
  section: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  signOutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
