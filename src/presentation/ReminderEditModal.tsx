import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { ReminderEditModalProps, ReminderEditorDraft } from "./types";
import { getTriggerDisplay, isBluetoothTrigger, isSpatialTrigger } from "./triggerDisplay";
import { getNotificationStyleDisplay, NOTIFICATION_STYLE_OPTIONS } from "./notificationStyleDisplay";
import { TriggerType } from "../domain/models/TriggerType";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { Field, TextField, SelectableCard, Pill } from "./components/FormControls";

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
  const { theme } = useTheme();
  const styles = createStyles(theme);
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

  return (
    <ModalShell
      visible={visible}
      title={mode === "create" ? "תזכורת חדשה" : "עריכת תזכורת"}
      subtitle={parserResult ? `רמת ביטחון: ${Math.round(parserResult.confidence * 100)}%` : "עריכה ידנית"}
      onClose={onCancel}
      footer={<GradientButton label={mode === "create" ? "צור תזכורת" : "שמור שינויים"} onPress={() => onConfirm(draft)} />}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Field label="כותרת">
            <TextField value={draft.title} onChangeText={(v) => updateDraft({ title: v })} placeholder="כותרת התזכורת" />
          </Field>
          <Field label="מה לעשות?">
            <TextField value={draft.action} onChangeText={(v) => updateDraft({ action: v })} placeholder="תיאור הפעולה" />
          </Field>
        </GlassSurface>

        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>סוג טריגר</Text>
          <View style={styles.pillGrid}>
            {TRIGGER_OPTIONS.map((option) => {
              const meta = getTriggerDisplay(option);
              return (
                <Pill
                  key={option}
                  selected={draft.triggerType === option}
                  label={meta.shortLabel}
                  icon={meta.icon}
                  onPress={() => updateDraft({ triggerType: option })}
                />
              );
            })}
          </View>
        </GlassSurface>

        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>סוג התראה</Text>
          <View style={styles.pillGrid}>
            {NOTIFICATION_STYLE_OPTIONS.map((option) => {
              const meta = getNotificationStyleDisplay(option);
              return (
                <Pill
                  key={option}
                  selected={draft.notificationStyle === option}
                  label={meta.label}
                  icon={meta.icon}
                  onPress={() => updateDraft({ notificationStyle: option })}
                />
              );
            })}
          </View>
          <Text style={styles.help}>{getNotificationStyleDisplay(draft.notificationStyle).help}</Text>
        </GlassSurface>

        {isSpatial ? (
          <GlassSurface radius={radii.lg} style={styles.section}>
            <Text style={styles.sectionTitle}>רדיוס: {Math.round(draft.radiusMeters)} מטרים</Text>
            <Slider
              minimumValue={25}
              maximumValue={5000}
              step={5}
              value={draft.radiusMeters}
              onValueChange={(v) => updateDraft({ radiusMeters: v })}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.inputBorder}
              thumbTintColor={theme.accent}
            />
          </GlassSurface>
        ) : null}

        {isSpatial ? (
          <GlassSurface radius={radii.lg} style={styles.section}>
            <Field label="מיקום">
              <TextField
                value={draft.parsedLocationQuery}
                onChangeText={(v) => updateDraft({ parsedLocationQuery: v })}
                placeholder="למשל: סבתא או קניון עזריאלי"
              />
            </Field>
            <Pressable onPress={onOpenMapPicker} style={styles.mapButton}>
              <Text style={styles.mapButtonText}>📍 בחר מיקום על המפה</Text>
            </Pressable>
            {draft.resolvedLocation ? (
              <View style={styles.locationSummary}>
                <Text style={styles.locationSummaryLabel}>מיקום שנבחר</Text>
                <Text style={styles.locationSummaryText}>{draft.resolvedLocation.address}</Text>
              </View>
            ) : null}
          </GlassSurface>
        ) : null}

        {isBluetooth ? (
          <GlassSurface radius={radii.lg} style={styles.section}>
            <Text style={styles.sectionTitle}>🚗 מכשיר רכב</Text>
            {availableBluetoothDevices.length > 0 ? (
              <View style={styles.pillGrid}>
                {availableBluetoothDevices.map((device) => (
                  <Pill
                    key={device.id}
                    selected={draft.targetBluetoothDeviceId === device.id}
                    label={device.name}
                    icon="🚗"
                    onPress={() => updateDraft({ targetBluetoothDeviceId: device.id })}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.help}>לא נמצאו מכשירי בלוטות'. אפשר להוסיף במסך המכשירים.</Text>
            )}
          </GlassSurface>
        ) : null}

        <SelectableCard selected={draft.isRecurring} onPress={() => updateDraft({ isRecurring: !draft.isRecurring })}>
          <View style={styles.switchRow}>
            <Switch
              value={draft.isRecurring}
              onValueChange={(v) => updateDraft({ isRecurring: v })}
              trackColor={{ true: theme.accent, false: theme.inputBorder }}
              thumbColor="#FFFFFF"
            />
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>תזכורת חוזרת</Text>
              <Text style={styles.help}>השאר פעילה גם אחרי שהופעלה.</Text>
            </View>
          </View>
        </SelectableCard>

        <View style={{ height: spacing.md }} />
      </ScrollView>
    </ModalShell>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    content: { gap: spacing.lg, paddingBottom: spacing.xl },
    section: { padding: spacing.lg, gap: spacing.md },
    sectionTitle: { color: theme.text, ...typography.heading, textAlign: "right" },
    help: { color: theme.textMuted, ...typography.caption, textAlign: "right", lineHeight: 18 },
    pillGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: spacing.sm },
    mapButton: { alignSelf: "flex-end", backgroundColor: theme.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill },
    mapButtonText: { color: theme.text, ...typography.caption, fontWeight: "700" },
    locationSummary: { backgroundColor: theme.accentSoft, borderRadius: radii.md, padding: spacing.md, gap: 4 },
    locationSummaryLabel: { color: theme.accent, ...typography.caption, fontWeight: "800", textAlign: "right" },
    locationSummaryText: { color: theme.text, ...typography.body, textAlign: "right" },
    switchRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    switchTextBlock: { flex: 1, alignItems: "flex-end" },
    switchLabel: { color: theme.text, ...typography.label, textAlign: "right" },
  });
}
