import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { LongPressEvent, Marker, MapPressEvent, Region } from "react-native-maps";
import { MapPickerModalProps, LocationSelection } from "./types";

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
    setRegion((current) => ({
      ...current,
      latitude,
      longitude,
    }));
  }

  function handleMapLongPress(event: LongPressEvent) {
    handleMapPress(event as MapPressEvent);
  }

  function handleConfirm() {
    if (selectedLocation) {
      onConfirm(selectedLocation);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>ביטול</Text>
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>בחירת מיקום</Text>
            <Text style={styles.subtitle}>חפש מקום או בחר ידנית על המפה.</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Pressable onPress={handleSearch} style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}>
            <Text style={styles.searchButtonText}>{isSearching ? "מחפש..." : "חיפוש"}</Text>
          </Pressable>
          <TextInput
            placeholder="חפש כתובת או עסק..."
            placeholderTextColor="#8B96A8"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCapitalize="none"
            textAlign="right"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        <View style={styles.mapShell}>
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
        </View>

        <View style={styles.coordinateCard}>
          <Text style={styles.coordinateLabel}>📍 מיקום נבחר</Text>
          <Text style={styles.coordinateHint}>
            {selectedLocation?.address ?? "לחץ על המפה או חפש מקום כדי לבחור."}
          </Text>
        </View>

        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
        >
          <Text style={styles.confirmButtonText}>אישור מיקום</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function toRegion(location: LocationSelection): Region {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08121F",
    padding: 20,
    gap: 16,
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#9AA8BA",
    marginTop: 4,
    textAlign: "right",
  },
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#15263A",
  },
  headerButtonText: {
    color: "#F4F7FB",
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#122033",
    color: "#F4F7FB",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#20324A",
    writingDirection: "rtl",
  },
  searchButton: {
    backgroundColor: "#7CDBB6",
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: 18,
    minHeight: 50,
  },
  searchButtonDisabled: {
    opacity: 0.65,
  },
  searchButtonText: {
    color: "#07111C",
    fontWeight: "800",
  },
  mapShell: {
    height: 300,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E3045",
    backgroundColor: "#0F1A2A",
  },
  map: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  webFallbackTitle: {
    color: "#F4F7FB",
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  webFallbackSubtitle: {
    color: "#9AA8BA",
    textAlign: "center",
  },
  coordinateCard: {
    backgroundColor: "#0E1827",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E3045",
    gap: 8,
  },
  coordinateLabel: {
    color: "#DDE7F2",
    fontWeight: "700",
    textAlign: "right",
  },
  coordinateHint: {
    color: "#9AA8BA",
    textAlign: "right",
    lineHeight: 22,
  },
  confirmButton: {
    backgroundColor: "#7CDBB6",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    color: "#07111C",
    fontWeight: "800",
    fontSize: 16,
  },
});
