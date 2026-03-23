// components/MapPicker.native.tsx
import React from "react";
import MapView, { Marker } from "react-native-maps";
import { View, StyleSheet } from "react-native";

export default function MapPicker({ onSelect, location }) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        onPress={(e) => onSelect(e.nativeEvent.coordinate)}
      >
        {location && <Marker coordinate={location} />}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: 400 },
});
