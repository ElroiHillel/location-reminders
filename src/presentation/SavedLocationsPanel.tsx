import { Pressable, StyleSheet, Text, View } from "react-native";
import { SavedLocation } from "../domain/models/SavedLocation";
import { SavedLocationsPanelProps } from "./types";

export function SavedLocationsPanel({
  locations,
  selectedLocationId,
  onSelectLocation,
  onDeleteLocation,
}: SavedLocationsPanelProps) {
  if (locations.length === 0) {
    return <Text style={styles.emptyState}>אין מיקומים שמורים עדיין.</Text>;
  }

  return (
    <View style={styles.container}>
      {locations.map((location) => {
        const isSelected = selectedLocationId === location.id;
        return (
          <Pressable
            key={location.id}
            onPress={() => onSelectLocation(location)}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={styles.row}>
              <Pressable onPress={() => onDeleteLocation(location.id)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>מחיקה</Text>
              </Pressable>
              <View style={styles.textBlock}>
                <Text style={styles.label}>{location.label}</Text>
                <Text style={styles.meta}>{location.address}</Text>
                <Text style={styles.meta}>
                  רדיוס {location.radiusMeters ?? 300} מ' · {(location.aliases ?? []).join(", ") || "ללא כינויים"}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emptyState: {
    color: "#9AA8BA",
    textAlign: "right",
    paddingVertical: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E3045",
    backgroundColor: "#0E1827",
    padding: 12,
  },
  cardSelected: {
    borderColor: "#7CDBB6",
    backgroundColor: "#102033",
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  textBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  label: {
    color: "#F4F7FB",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  meta: {
    color: "#9AA8BA",
    textAlign: "right",
    fontSize: 12,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#3A1D28",
  },
  deleteText: {
    color: "#FFB8CB",
    fontWeight: "700",
    fontSize: 12,
  },
});
