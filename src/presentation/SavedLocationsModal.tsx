import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SavedLocation } from "../domain/models/SavedLocation";
import { LocationSelection, SavedLocationsModalProps } from "./types";
import { SavedLocationsPanel } from "./SavedLocationsPanel";
import { MapPickerModal } from "./MapPickerModal";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { Field, TextField } from "./components/FormControls";
import { hapticSelection } from "./theme/haptics";

type QuickCategory = "HOME" | "WORK" | "CUSTOM";

interface SavedLocationDraft {
  id?: string;
  category: QuickCategory;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  radiusMeters: string;
  aliasesText: string;
}

const DEFAULT_DRAFT: SavedLocationDraft = { category: "CUSTOM", label: "", address: "", radiusMeters: "300", aliasesText: "" };

const CATEGORY_LABELS: Record<QuickCategory, string> = { HOME: "בית", WORK: "עבודה", CUSTOM: "מותאם אישית" };

export function SavedLocationsModal({
  visible,
  locations,
  onCancel,
  onSearchLocation,
  onSaveLocation,
  onDeleteLocation,
}: SavedLocationsModalProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [draft, setDraft] = useState<SavedLocationDraft>(DEFAULT_DRAFT);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(DEFAULT_DRAFT);
      setSelectedLocationId(undefined);
      setIsMapVisible(false);
    }
  }, [visible]);

  const canSave = useMemo(
    () => Boolean(draft.label.trim() && draft.address.trim() && typeof draft.latitude === "number" && typeof draft.longitude === "number"),
    [draft],
  );

  function handleSelectCategory(category: QuickCategory) {
    hapticSelection();
    setDraft((current) => ({
      ...current,
      category,
      label: category === "CUSTOM" ? current.label : CATEGORY_LABELS[category],
      aliasesText: category === "CUSTOM" ? current.aliasesText : CATEGORY_LABELS[category],
    }));
  }

  function handleEditLocation(location: SavedLocation) {
    setSelectedLocationId(location.id);
    setDraft({
      id: location.id,
      category: inferCategory(location.label),
      label: location.label,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: String(location.radiusMeters ?? 300),
      aliasesText: (location.aliases ?? []).join(", "),
    });
  }

  async function handleDelete(locationId: string) {
    await onDeleteLocation(locationId);
    if (draft.id === locationId) {
      setDraft(DEFAULT_DRAFT);
      setSelectedLocationId(undefined);
    }
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    try {
      const normalizedAliases = draft.aliasesText.split(",").map((item) => item.trim()).filter(Boolean);
      const payload: SavedLocation = {
        id: draft.id ?? `saved-${Date.now()}`,
        label: draft.label.trim(),
        address: draft.address.trim(),
        latitude: draft.latitude!,
        longitude: draft.longitude!,
        radiusMeters: Number.parseInt(draft.radiusMeters, 10) || 300,
        aliases: normalizedAliases,
      };
      await onSaveLocation(payload);
      setDraft(DEFAULT_DRAFT);
      setSelectedLocationId(undefined);
    } finally {
      setIsSaving(false);
    }
  }

  function handleMapConfirm(location: LocationSelection) {
    setDraft((current) => ({ ...current, address: location.address, latitude: location.latitude, longitude: location.longitude }));
    setIsMapVisible(false);
  }

  return (
    <ModalShell
      visible={visible}
      title="מיקומים שמורים"
      subtitle="בית, עבודה ומקומות מותאמים אישית"
      onClose={onCancel}
      footer={
        <GradientButton
          label={isSaving ? "שומר..." : draft.id ? "עדכן מיקום" : "שמור מיקום"}
          onPress={handleSave}
          disabled={!canSave || isSaving}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>מיקומים קיימים</Text>
          <SavedLocationsPanel
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleEditLocation}
            onDeleteLocation={handleDelete}
          />
        </GlassSurface>

        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>{draft.id ? "עריכת מיקום" : "מיקום חדש"}</Text>

          <View style={styles.segmentRow}>
            {(Object.keys(CATEGORY_LABELS) as QuickCategory[]).map((category) => {
              const selected = draft.category === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => handleSelectCategory(category)}
                  style={[styles.segment, selected && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{CATEGORY_LABELS[category]}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field label="שם מיקום">
            <TextField value={draft.label} onChangeText={(v) => setDraft((c) => ({ ...c, label: v }))} placeholder="לדוגמה: בית" />
          </Field>

          <Field label="כתובת / קואורדינטות">
            <TextField
              value={draft.address}
              onChangeText={(v) => setDraft((c) => ({ ...c, address: v }))}
              placeholder="הזן כתובת או בחר מהמפה"
            />
            <Pressable onPress={() => { hapticSelection(); setIsMapVisible(true); }} style={styles.mapButton}>
              <Text style={styles.mapButtonText}>📍 בחר במפה</Text>
            </Pressable>
          </Field>

          <Field label="רדיוס (מטרים)">
            <TextField
              value={draft.radiusMeters}
              onChangeText={(v) => setDraft((c) => ({ ...c, radiusMeters: v }))}
              keyboardType="numeric"
              placeholder="300"
            />
          </Field>

          <Field label="כינויים / מילים נרדפות (מופרד בפסיקים)">
            <TextField
              value={draft.aliasesText}
              onChangeText={(v) => setDraft((c) => ({ ...c, aliasesText: v }))}
              placeholder="ביתי, הדירה, לבית"
              multiline
              style={styles.multiline}
            />
          </Field>

          <Pressable onPress={() => { setDraft(DEFAULT_DRAFT); setSelectedLocationId(undefined); }} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>נקה טופס</Text>
          </Pressable>
        </GlassSurface>

        <View style={{ height: spacing.md }} />
      </ScrollView>

      <MapPickerModal
        visible={isMapVisible}
        initialQuery={draft.address}
        initialLocation={
          typeof draft.latitude === "number" && typeof draft.longitude === "number"
            ? { latitude: draft.latitude, longitude: draft.longitude, address: draft.address }
            : null
        }
        onCancel={() => setIsMapVisible(false)}
        onSearchLocation={onSearchLocation}
        onConfirm={handleMapConfirm}
      />
    </ModalShell>
  );
}

function inferCategory(label: string): QuickCategory {
  const normalized = label.trim().toLowerCase();
  if (normalized === "בית") {
    return "HOME";
  }
  if (normalized === "עבודה") {
    return "WORK";
  }
  return "CUSTOM";
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    content: { gap: spacing.lg, paddingBottom: spacing.xl },
    section: { padding: spacing.lg, gap: spacing.md },
    sectionTitle: { color: theme.text, ...typography.heading, textAlign: "right" },
    segmentRow: { flexDirection: "row-reverse", gap: spacing.sm },
    segment: { flex: 1, borderRadius: radii.sm, paddingVertical: spacing.md, alignItems: "center", backgroundColor: theme.chip, borderWidth: 1, borderColor: theme.glassBorder },
    segmentActive: { borderColor: theme.accent, backgroundColor: theme.chipActive },
    segmentText: { color: theme.textSecondary, ...typography.caption, fontWeight: "700" },
    segmentTextActive: { color: theme.accent },
    mapButton: { alignSelf: "flex-end", backgroundColor: theme.chip, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    mapButtonText: { color: theme.text, ...typography.caption, fontWeight: "700" },
    multiline: { minHeight: 76, textAlignVertical: "top" },
    clearButton: { alignSelf: "flex-end", borderRadius: radii.sm, backgroundColor: theme.chip, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    clearButtonText: { color: theme.text, ...typography.caption, fontWeight: "700" },
  });
}
