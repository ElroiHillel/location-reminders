import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { LongPressEvent, Marker, MapPressEvent, Region } from "react-native-maps";
import { MapPickerModalProps, LocationSelection } from "./types";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { TextField } from "./components/FormControls";

const DEFAULT_REGION: Region = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

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

  const [query, setQuery] = useState(initialQuery);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(initialLocation);
  const [region, setRegion] = useState<Region>(initialLocation ? toRegion(initialLocation) : DEFAULT_REGION);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setSelectedLocation(initialLocation);
      setRegion(initialLocation ? toRegion(initialLocation) : DEFAULT_REGION);
    }
  }, [visible, initialQuery, initialLocation]);

  const canConfirm = Boolean(selectedLocation);
  const mapRegion = useMemo(() => region, [region]);

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
        setRegion(toRegion(result));
      }
    } finally {
      setIsSearching(false);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const nextSelection: LocationSelection = {
      latitude,
      longitude,
      address: selectedLocation?.address ?? (query.trim() || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`),
    };
    setSelectedLocation(nextSelection);
    setRegion((current) => ({ ...current, latitude, longitude }));
  }

  function handleMapLongPress(event: LongPressEvent) {
    handleMapPress(event as MapPressEvent);
  }

  return (
    <ModalShell
      visible={visible}
      title="בחירת מיקום"
      subtitle="חפש מקום או בחר ידנית על המפה"
      onClose={onCancel}
      footer={
        <GradientButton
          label="אישור מיקום"
          onPress={() => selectedLocation && onConfirm(selectedLocation)}
          disabled={!canConfirm}
        />
      }
    >
      <View style={styles.searchRow}>
        <Pressable onPress={handleSearch} style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}>
          <Text style={styles.searchButtonText}>{isSearching ? "מחפש..." : "חיפוש"}</Text>
        </Pressable>
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
        {Platform.OS === "web" ? (
          <View style={styles.webFallback}>
            <Text style={styles.webFallbackTitle}>המפה לא זמינה בדפדפן.</Text>
            <Text style={styles.webFallbackSubtitle}>השתמש בחיפוש למעלה.</Text>
          </View>
        ) : (
          <MapView style={styles.map} region={mapRegion} onPress={handleMapPress} onLongPress={handleMapLongPress}>
            {selectedLocation ? (
              <Marker coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }} />
            ) : null}
          </MapView>
        )}
      </GlassSurface>

      <GlassSurface radius={radii.lg} style={styles.coordinateCard}>
        <Text style={styles.coordinateLabel}>📍 מיקום נבחר</Text>
        <Text style={styles.coordinateHint}>
          {selectedLocation?.address ?? "לחץ על המפה או חפש מקום כדי לבחור."}
        </Text>
      </GlassSurface>
    </ModalShell>
  );
}

function toRegion(location: LocationSelection): Region {
  return { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    searchRow: { flexDirection: "row-reverse", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md },
    searchInput: { flex: 1 },
    searchButton: { backgroundColor: theme.accent, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.md, minHeight: 48 },
    searchButtonDisabled: { opacity: 0.6 },
    searchButtonText: { color: theme.onAccent, ...typography.label, fontWeight: "800" },
    mapShell: { height: 320, overflow: "hidden", marginBottom: spacing.md },
    map: { flex: 1 },
    webFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    webFallbackTitle: { color: theme.text, ...typography.heading, marginBottom: spacing.sm, textAlign: "center" },
    webFallbackSubtitle: { color: theme.textSecondary, textAlign: "center" },
    coordinateCard: { padding: spacing.lg, gap: spacing.sm },
    coordinateLabel: { color: theme.text, ...typography.label, textAlign: "right" },
    coordinateHint: { color: theme.textSecondary, ...typography.body, textAlign: "right", lineHeight: 22 },
  });
}
