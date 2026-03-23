import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { bootstrapAuth, getUser, getPending, onAuthChange } from "@/lib/authStore";

export default function Index() {
  const [ready, setReady]     = useState(false);
  const [user, setUser]       = useState(getUser());
  const [pending, setPending] = useState(getPending());

  useEffect(() => {
    (async () => {
      await bootstrapAuth();
      setUser(getUser());
      setPending(getPending());
      setReady(true);
    })();
    return onAuthChange(() => {
      setUser(getUser());
      setPending(getPending());
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // ← Show pending screen
  if (pending && !user) return <Redirect href="/(auth)/pending" />;

  if (!user) return <Redirect href="/(auth)/login" />;

  switch (user.role) {
    case "superadmin": return <Redirect href="/roles/superadmin/overview" />;
    case "rider":      return <Redirect href="/roles/rider/RiderOverview" />;
    case "cook":       return <Redirect href="/roles/cook/CookOverview" />;
    case "supervisor": return <Redirect href="/roles/supervisor/SupervisorOverview" />;
    default:           return <Redirect href="/roles/refill/RefillCoordinatorOverview" />;
  }
}