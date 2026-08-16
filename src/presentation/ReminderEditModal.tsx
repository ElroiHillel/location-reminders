import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { ReminderEditModalProps, ReminderEditorDraft } from "./types";
import { getTriggerDisplay, isBluetoothTrigger, isSpatialTrigger } from "./triggerDisplay";
import { TriggerType } from "../domain/models/TriggerType";

const TRIGGER_OPTIONS: TriggerType[] = [
  TriggerType.ENTER,
  TriggerType.EXIT,
  TriggerType.NEARBY,
  TriggerType.BLUETOOTH_CONNECT,
  TriggerType.BLUETOOTH_DISCONNECT,
];

export function ReminderEditModal({
  visible,
  mode,
  parserResult,
  initialDraft,
  availableBluetoothDevices,
  onCancel,
  onOpenMapPicker,
  onConfirm,
}: ReminderEditModalProps) {
  const [draft, setDraft] = useState<ReminderEditorDraft>(initialDraft);

  useEffect(() => {
    if (visible) {
      setDraft(initialDraft);
    }
  }, [visible, initialDraft]);

  const isSpatial = useMemo(() => isSpatialTrigger(draft.triggerType), [draft.triggerType]);
  const isBluetooth = useMemo(() => isBluetoothTrigger(draft.triggerType), [draft.triggerType]);

  function updateDraft(patch: Partial<ReminderEditorDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleConfirm() {
    onConfirm(draft);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>ביטול</Text>
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>{mode === "create" ? "יצירת תזכורת" : "עריכת תזכורת"}</Text>
            <Text style={styles.subtitle}>
              {parserResult ? `רמת ביטחון: ${Math.round(parserResult.confidence * 100)}%` : "עריכה ידנית"}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>כותרת</Text>
            <TextInput
              style={styles.textInput}
              value={draft.title}
              onChangeText={(value) => updateDraft({ title: value })}
              placeholder="כותרת התזכורת"
              placeholderTextColor="#92A2B7"
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>מה לעשות?</Text>
            <TextInput
              style={styles.textInput}
              value={draft.action}
              onChangeText={(value) => updateDraft({ action: value })}
              placeholder="תיאור הפעולה"
              placeholderTextColor="#92A2B7"
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>סוג טריגר</Text>
            <View style={styles.optionGrid}>
              {TRIGGER_OPTIONS.map((triggerOption) => {
                const meta = getTriggerDisplay(triggerOption);
                const isSelected = draft.triggerType === triggerOption;
                return (
                  <Pressable
                    key={triggerOption}
                    onPress={() => updateDraft({ triggerType: triggerOption })}
                    style={[
                      styles.optionPill,
                      isSelected && { backgroundColor: meta.backgroundColor, borderColor: meta.backgroundColor },
                    ]}
                  >
                    <Text style={styles.optionIcon}>{meta.icon}</Text>
                    <Text style={[styles.optionText, isSelected && { color: meta.color }]}>{meta.shortLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isSpatial ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>רדיוס: {Math.round(draft.radiusMeters)} מטרים</Text>
              <Slider
                minimumValue={25}
                maximumValue={5000}
                step={5}
                value={draft.radiusMeters}
                onValueChange={(value) => updateDraft({ radiusMeters: value })}
                minimumTrackTintColor="#7CDBB6"
                maximumTrackTintColor="#20324A"
                thumbTintColor="#FFFFFF"
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <View style={styles.switchRow}>
              <Switch value={draft.isRecurring} onValueChange={(value) => updateDraft({ isRecurring: value })} />
              <View style={styles.switchTextBlock}>
                <Text style={styles.fieldLabel}>תזכורת חוזרת</Text>
                <Text style={styles.fieldHelp}>השאר את התזכורת פעילה גם אחרי שהופעלה.</Text>
              </View>
            </View>
          </View>

          {isSpatial ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>חיפוש מיקום</Text>
              <TextInput
                style={styles.textInput}
                value={draft.parsedLocationQuery}
                onChangeText={(value) => updateDraft({ parsedLocationQuery: value })}
                placeholder="למשל: סבתא או קניון עזריאלי"
                placeholderTextColor="#92A2B7"
                textAlign="right"
              />
              <Pressable onPress={onOpenMapPicker} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>📍 פתח בחירת מיקום במפה</Text>
              </Pressable>
            </View>
          ) : null}

          {isSpatial && draft.resolvedLocation ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>מיקום שנבחר</Text>
              <Text style={styles.summaryText}>{draft.resolvedLocation.address}</Text>
            </View>
          ) : null}

          {isBluetooth ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>🚗 מכשיר רכב</Text>
              <View style={styles.optionGrid}>
                {availableBluetoothDevices.length > 0 ? (
                  availableBluetoothDevices.map((device) => {
                    const isSelected = draft.targetBluetoothDeviceId === device.id;
                    return (
                      <Pressable
                        key={device.id}
                        onPress={() => updateDraft({ targetBluetoothDeviceId: device.id })}
                        style={[styles.optionPill, isSelected && styles.optionPillSelected]}
                      >
                        <Text style={styles.optionIcon}>🚗</Text>
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{device.name}</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.fieldHelp}>לא נמצאו מכשירי רכב מוצמדים.</Text>
                )}
              </View>
            </View>
          ) : null}

          <Pressable onPress={handleConfirm} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{mode === "create" ? "צור תזכורת" : "שמור שינויים"}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08121F",
    padding: 20,
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 26,
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
  content: {
    paddingBottom: 36,
    gap: 16,
  },
  summaryCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#0E1827",
    borderWidth: 1,
    borderColor: "#1E3045",
    gap: 6,
  },
  summaryLabel: {
    color: "#7CDBB6",
    fontWeight: "700",
    textAlign: "right",
  },
  summaryText: {
    color: "#DDE7F2",
    textAlign: "right",
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: "#F4F7FB",
    fontWeight: "700",
    textAlign: "right",
  },
  fieldHelp: {
    color: "#9AA8BA",
    textAlign: "right",
  },
  textInput: {
    backgroundColor: "#122033",
    color: "#F4F7FB",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#20324A",
    writingDirection: "rtl",
  },
  optionGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  optionPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#122033",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#20324A",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionPillSelected: {
    backgroundColor: "#7CDBB6",
    borderColor: "#7CDBB6",
  },
  optionIcon: {
    fontSize: 16,
  },
  optionText: {
    color: "#DDE7F2",
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#07111C",
  },
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  switchTextBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  secondaryButton: {
    alignSelf: "flex-end",
    backgroundColor: "#15263A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: "#F4F7FB",
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: "#7CDBB6",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#07111C",
    fontWeight: "800",
    fontSize: 16,
  },
});
