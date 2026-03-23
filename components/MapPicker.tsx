import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";

let MapView: any = null;
let Marker: any = null;

// Load native maps ONLY on mobile
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
}

export default function MapPicker({ stops, setStops }) {
  // Web fallback
  if (Platform.OS === "web") {
    return (
      <View style={styles.webPlaceholder}>
        <Text style={{ color: "#555" }}>
          Map is not supported on Web in Expo.
          Use Android/iOS app to add route stops.
        </Text>
      </View>
    );
  }

  // ---------- Mobile Map ----------
  const addStop = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setStops((prev: any[]) => [
      ...prev,
      { name: `Stop ${prev.length + 1}`, lat: latitude, lng: longitude },
    ]);
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={StyleSheet.absoluteFill}
        onPress={addStop}
        initialRegion={{
          latitude: 28.6139,
          longitude: 77.2090,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {stops.map((s, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.name}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 350,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ddd",
  },
  webPlaceholder: {
    height: 350,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
});
