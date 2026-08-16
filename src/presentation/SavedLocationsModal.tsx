import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SavedLocation } from "../domain/models/SavedLocation";
import { LocationSelection, SavedLocationsModalProps } from "./types";
import { SavedLocationsPanel } from "./SavedLocationsPanel";
import { MapPickerModal } from "./MapPickerModal";

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

const DEFAULT_DRAFT: SavedLocationDraft = {
  category: "CUSTOM",
  label: "",
  address: "",
  radiusMeters: "300",
  aliasesText: "",
};

const CATEGORY_LABELS: Record<QuickCategory, string> = {
  HOME: "בית",
  WORK: "עבודה",
  CUSTOM: "מקום מותאם אישית",
};

export function SavedLocationsModal({
  visible,
  locations,
  onCancel,
  onSearchLocation,
  onSaveLocation,
  onDeleteLocation,
}: SavedLocationsModalProps) {
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

  const canSave = useMemo(() => {
    return Boolean(draft.label.trim() && draft.address.trim() && typeof draft.latitude === "number" && typeof draft.longitude === "number");
  }, [draft]);

  function handleSelectCategory(category: QuickCategory) {
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
      const normalizedAliases = draft.aliasesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

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
    setDraft((current) => ({
      ...current,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
    setIsMapVisible(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>סגירה</Text>
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>מיקומים שמורים</Text>
            <Text style={styles.subtitle}>ניהול בית, עבודה ומקומות מותאמים אישית.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מיקומים קיימים</Text>
            <SavedLocationsPanel
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelectLocation={handleEditLocation}
              onDeleteLocation={handleDelete}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{draft.id ? "עריכת מיקום" : "מיקום חדש"}</Text>

            <View style={styles.segmentedRow}>
              {(Object.keys(CATEGORY_LABELS) as QuickCategory[]).map((category) => {
                const selected = draft.category === category;
                return (
                  <Pressable
                    key={category}
                    onPress={() => handleSelectCategory(category)}
                    style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{CATEGORY_LABELS[category]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field label="שם מיקום">
              <TextInput
                value={draft.label}
                onChangeText={(value) => setDraft((current) => ({ ...current, label: value }))}
                placeholder="לדוגמה: בית"
                placeholderTextColor="#8B96A8"
                style={styles.input}
                textAlign="right"
              />
            </Field>

            <Field label="כתובת / קואורדינטות">
              <TextInput
                value={draft.address}
                onChangeText={(value) => setDraft((current) => ({ ...current, address: value }))}
                placeholder="הזן כתובת או בחר מהמפה"
                placeholderTextColor="#8B96A8"
                style={styles.input}
                textAlign="right"
              />
              <Pressable onPress={() => setIsMapVisible(true)} style={styles.mapButton}>
                <Text style={styles.mapButtonText}>בחר במפה</Text>
              </Pressable>
            </Field>

            <Field label="רדיוס (מטרים)">
              <TextInput
                value={draft.radiusMeters}
                onChangeText={(value) => setDraft((current) => ({ ...current, radiusMeters: value }))}
                keyboardType="numeric"
                placeholder="300"
                placeholderTextColor="#8B96A8"
                style={styles.input}
                textAlign="right"
              />
            </Field>

            <Field label="כינויים / מילים נרדפות (מופרד בפסיקים)">
              <TextInput
                value={draft.aliasesText}
                onChangeText={(value) => setDraft((current) => ({ ...current, aliasesText: value }))}
                placeholder="ביתי, הדירה, לבית"
                placeholderTextColor="#8B96A8"
                style={[styles.input, styles.multilineInput]}
                textAlign="right"
                multiline
              />
            </Field>

            <View style={styles.formButtons}>
              <Pressable
                onPress={handleSave}
                disabled={!canSave || isSaving}
                style={[styles.saveButton, (!canSave || isSaving) && styles.saveButtonDisabled]}
              >
                <Text style={styles.saveButtonText}>{isSaving ? "שומר..." : draft.id ? "עדכן מיקום" : "שמור מיקום"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDraft(DEFAULT_DRAFT);
                  setSelectedLocationId(undefined);
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>נקה טופס</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <MapPickerModal
          visible={isMapVisible}
          initialQuery={draft.address}
          initialLocation={
            typeof draft.latitude === "number" && typeof draft.longitude === "number"
              ? {
                  latitude: draft.latitude,
                  longitude: draft.longitude,
                  address: draft.address,
                }
              : null
          }
          onCancel={() => setIsMapVisible(false)}
          onSearchLocation={onSearchLocation}
          onConfirm={handleMapConfirm}
        />
      </SafeAreaView>
    </Modal>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08121F",
    padding: 20,
    gap: 14,
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
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
  content: {
    gap: 16,
    paddingBottom: 24,
  },
  section: {
    borderRadius: 20,
    backgroundColor: "#0F1A2A",
    borderWidth: 1,
    borderColor: "#1E3045",
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: "#F4F7FB",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  segmentedRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: "#15263A",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#20324A",
  },
  segmentButtonActive: {
    borderColor: "#7CDBB6",
    backgroundColor: "#173245",
  },
  segmentText: {
    color: "#D3DEEC",
    fontWeight: "700",
    fontSize: 12,
  },
  segmentTextActive: {
    color: "#7CDBB6",
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "#DDE7F2",
    fontWeight: "700",
    textAlign: "right",
  },
  input: {
    borderRadius: 14,
    backgroundColor: "#122033",
    borderWidth: 1,
    borderColor: "#20324A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F7FB",
    writingDirection: "rtl",
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  mapButton: {
    alignSelf: "flex-end",
    backgroundColor: "#22344A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapButtonText: {
    color: "#DDE7F2",
    fontWeight: "700",
  },
  formButtons: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#7CDBB6",
    alignItems: "center",
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#07111C",
    fontWeight: "800",
  },
  clearButton: {
    borderRadius: 14,
    backgroundColor: "#1D3044",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clearButtonText: {
    color: "#F4F7FB",
    fontWeight: "700",
  },
});
