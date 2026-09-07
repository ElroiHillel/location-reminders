import { Pressable, StyleSheet, Text, View } from "react-native";
import { SavedLocationsPanelProps } from "./types";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { hapticLight } from "./theme/haptics";

export function SavedLocationsPanel({
  locations,
  selectedLocationId,
  onSelectLocation,
  onDeleteLocation,
}: SavedLocationsPanelProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
            onPress={() => { hapticLight(); onSelectLocation(location); }}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={styles.row}>
              <Pressable onPress={() => onDeleteLocation(location.id)} style={styles.deleteButton} hitSlop={6}>
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

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { gap: spacing.sm },
    emptyState: { color: theme.textSecondary, textAlign: "right", paddingVertical: spacing.sm },
    card: { borderRadius: radii.md, borderWidth: 1, borderColor: theme.glassBorder, backgroundColor: theme.chip, padding: spacing.md },
    cardSelected: { borderColor: theme.accent, backgroundColor: theme.chipActive },
    row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
    textBlock: { flex: 1, alignItems: "flex-end", gap: 4 },
    label: { color: theme.text, ...typography.label, fontWeight: "800", textAlign: "right" },
    meta: { color: theme.textMuted, ...typography.caption, textAlign: "right" },
    deleteButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: theme.dangerSoft },
    deleteText: { color: theme.danger, ...typography.caption, fontWeight: "700" },
  });
}
