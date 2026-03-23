// components/MapPicker.web.tsx
import React from "react";

export default function MapPicker() {
  return (
    <div style={{ width: "100%", height: 400 }}>
      <iframe
        src="https://maps.google.com"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
    </div>
  );
}
