import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { MapPickerModalProps, LocationSelection } from "./types";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { TextField } from "./components/FormControls";
import { hapticSelection } from "./theme/haptics";

const DEFAULT_CENTER = { latitude: 32.0853, longitude: 34.7818 };

/**
 * Keyless map picker: a Leaflet + OpenStreetMap map inside a WebView. Needs no
 * API key at all (matching the app's keyless Nominatim geocoding), so it works
 * the same in Expo Go and in a standalone build with nothing for the user to set.
 */
export function MapPickerModal({
  visible,
  initialQuery = "",
  initialLocation = null,
  onCancel,
  onSearchLocation,
  onConfirm,
}: MapPickerModalProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const webViewRef = useRef<WebView>(null);

  const [query, setQuery] = useState(initialQuery);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(initialLocation);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setSelectedLocation(initialLocation);
    }
  }, [visible, initialQuery, initialLocation]);

  const initialCenter = initialLocation ?? DEFAULT_CENTER;
  // Rebuild (and reload the WebView) only when the initial coordinates change,
  // not on every keystroke — live updates go through injectJavaScript instead.
  const html = useMemo(
    () => buildLeafletHtml(initialCenter.latitude, initialCenter.longitude, Boolean(initialLocation)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialLocation?.latitude, initialLocation?.longitude],
  );

  function moveMapTo(latitude: number, longitude: number) {
    webViewRef.current?.injectJavaScript(`window.__setLocation && window.__setLocation(${latitude}, ${longitude}); true;`);
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type: string; lat?: number; lng?: number };
      if (payload.type === "select" && typeof payload.lat === "number" && typeof payload.lng === "number") {
        hapticSelection();
        const address = query.trim() || `${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}`;
        setSelectedLocation({ latitude: payload.lat, longitude: payload.lng, address });
      }
    } catch {
      // Ignore malformed messages from the page.
    }
  }

  async function handleSearch() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }
    setIsSearching(true);
    try {
      const result = await onSearchLocation(trimmedQuery);
      if (result) {
        setSelectedLocation(result);
        moveMapTo(result.latitude, result.longitude);
      }
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <ModalShell
      visible={visible}
      title="בחירת מיקום"
      subtitle="חפש מקום או הקש על המפה לבחירה"
      onClose={onCancel}
      footer={
        <GradientButton
          label="אישור מיקום"
          onPress={() => selectedLocation && onConfirm(selectedLocation)}
          disabled={!selectedLocation}
        />
      }
    >
      <View style={styles.searchRow}>
        <GradientButton label={isSearching ? "מחפש..." : "חיפוש"} onPress={handleSearch} disabled={isSearching} style={styles.searchButton} />
        <View style={styles.searchInput}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="חפש כתובת או עסק..."
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      <GlassSurface radius={radii.lg} style={styles.mapShell}>
        {visible ? (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html }}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            style={styles.map}
          />
        ) : null}
      </GlassSurface>

      <GlassSurface radius={radii.lg} style={styles.coordinateCard}>
        <Text style={styles.coordinateLabel}>📍 מיקום נבחר</Text>
        <Text style={styles.coordinateHint}>
          {selectedLocation?.address ?? "הקש על המפה או חפש מקום כדי לבחור."}
        </Text>
      </GlassSurface>
    </ModalShell>
  );
}

function buildLeafletHtml(latitude: number, longitude: number, hasMarker: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
  var map = L.map('map').setView([${latitude}, ${longitude}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var marker = ${hasMarker ? `L.marker([${latitude}, ${longitude}]).addTo(map)` : "null"};
  function setMarker(lat, lng){
    if (marker){ marker.setLatLng([lat, lng]); } else { marker = L.marker([lat, lng]).addTo(map); }
  }
  map.on('click', function(e){
    setMarker(e.latlng.lat, e.latlng.lng);
    post({ type: 'select', lat: e.latlng.lat, lng: e.latlng.lng });
  });
  window.__setLocation = function(lat, lng){
    map.setView([lat, lng], 15);
    setMarker(lat, lng);
  };
  post({ type: 'ready' });
</script>
</body>
</html>`;
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    searchRow: { flexDirection: "row-reverse", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md },
    searchInput: { flex: 1 },
    searchButton: { minWidth: 92 },
    mapShell: { height: 340, overflow: "hidden", marginBottom: spacing.md, backgroundColor: theme.bgElevated },
    map: { flex: 1, backgroundColor: "transparent" },
    coordinateCard: { padding: spacing.lg, gap: spacing.sm },
    coordinateLabel: { color: theme.text, ...typography.label, textAlign: "right" },
    coordinateHint: { color: theme.textSecondary, ...typography.body, textAlign: "right", lineHeight: 22 },
  });
}
