import { useEffect, useMemo, useState } from "react";
import { PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { BluetoothDevicesModalProps } from "./types";
import { isBluetoothAclDetectionSupported } from "../infrastructure/adapters/AndroidBluetoothClassicTriggerService";
import { useTheme } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { Field, TextField } from "./components/FormControls";
import { hapticLight } from "./theme/haptics";

interface DeviceDraft {
  id?: string;
  name: string;
  macAddressOrUuid: string;
  isVehicle: boolean;
}

const EMPTY_DRAFT: DeviceDraft = { name: "", macAddressOrUuid: "", isVehicle: true };

export function BluetoothDevicesModal({ visible, devices, onCancel, onSaveDevice, onDeleteDevice }: BluetoothDevicesModalProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [draft, setDraft] = useState<DeviceDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<{ name: string; address: string }[]>([]);
  const [isLoadingPaired, setIsLoadingPaired] = useState(false);
  const [pairedError, setPairedError] = useState<string | null>(null);

  const canPickPairedDevices = isBluetoothAclDetectionSupported();
  const canSave = useMemo(() => Boolean(draft.name.trim() && draft.macAddressOrUuid.trim()), [draft]);

  useEffect(() => {
    if (visible) {
      setDraft(EMPTY_DRAFT);
      setPairedDevices([]);
      setPairedError(null);
    }
  }, [visible]);

  async function handleLoadPairedDevices() {
    setIsLoadingPaired(true);
    setPairedError(null);
    try {
      if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setPairedError("ההרשאה לבלוטות' נדחתה.");
          return;
        }
      }
      const bonded = await RNBluetoothClassic.getBondedDevices();
      setPairedDevices(bonded.map((device) => ({ name: device.name, address: device.address })));
    } catch (error) {
      setPairedError(error instanceof Error ? error.message : "לא ניתן היה לטעון מכשירים מזווגים.");
    } finally {
      setIsLoadingPaired(false);
    }
  }

  function handlePickPairedDevice(device: { name: string; address: string }) {
    hapticLight();
    setDraft((current) => ({ ...current, name: device.name || current.name, macAddressOrUuid: device.address }));
  }

  function handleEdit(device: BluetoothDevice) {
    hapticLight();
    setDraft({ id: device.id, name: device.name, macAddressOrUuid: device.macAddressOrUuid, isVehicle: device.isVehicle });
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    try {
      await onSaveDevice({
        id: draft.id ?? `bt-${Date.now()}`,
        name: draft.name.trim(),
        macAddressOrUuid: draft.macAddressOrUuid.trim(),
        isVehicle: draft.isVehicle,
      });
      setDraft(EMPTY_DRAFT);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(deviceId: string) {
    await onDeleteDevice(deviceId);
    if (draft.id === deviceId) {
      setDraft(EMPTY_DRAFT);
    }
  }

  return (
    <ModalShell
      visible={visible}
      title="מכשירי בלוטות'"
      subtitle="נהל מכשירים (כמו הרכב) לתזכורות חיבור"
      onClose={onCancel}
      footer={<GradientButton label={isSaving ? "שומר..." : draft.id ? "עדכן מכשיר" : "שמור מכשיר"} onPress={handleSave} disabled={!canSave || isSaving} />}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!canPickPairedDevices ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              זיהוי חיבור אמיתי לרכב עובד רק בבנייה מותקנת (APK), לא בתוך Expo Go. אפשר להוסיף מכשירים ידנית, אך
              ההתראה בפועל תתחיל לעבוד אחרי בנייה עם EAS או ‎expo run:android‎.
            </Text>
          </View>
        ) : null}

        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>מכשירים שמורים</Text>
          {devices.length === 0 ? (
            <Text style={styles.empty}>אין מכשירי בלוטות' שמורים עדיין.</Text>
          ) : (
            devices.map((device) => (
              <Pressable key={device.id} onPress={() => handleEdit(device)} style={styles.deviceCard}>
                <Pressable onPress={() => handleDelete(device.id)} style={styles.deleteButton} hitSlop={6}>
                  <Text style={styles.deleteText}>מחיקה</Text>
                </Pressable>
                <View style={styles.deviceTextBlock}>
                  <Text style={styles.deviceName}>{device.isVehicle ? "🚗 " : ""}{device.name}</Text>
                  <Text style={styles.deviceMeta}>{device.macAddressOrUuid}</Text>
                </View>
              </Pressable>
            ))
          )}
        </GlassSurface>

        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>{draft.id ? "עריכת מכשיר" : "מכשיר חדש"}</Text>

          {canPickPairedDevices ? (
            <View style={styles.field}>
              <Pressable onPress={handleLoadPairedDevices} style={styles.pairedButton} disabled={isLoadingPaired}>
                <Text style={styles.pairedButtonText}>{isLoadingPaired ? "טוען..." : "בחר ממכשירים מזווגים"}</Text>
              </Pressable>
              {pairedError ? <Text style={styles.errorText}>{pairedError}</Text> : null}
              {pairedDevices.map((device) => (
                <Pressable key={device.address} onPress={() => handlePickPairedDevice(device)} style={styles.pairedOption}>
                  <Text style={styles.pairedOptionText}>{device.name || "מכשיר ללא שם"} · {device.address}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Field label="שם המכשיר">
            <TextField value={draft.name} onChangeText={(v) => setDraft((c) => ({ ...c, name: v }))} placeholder="לדוגמה: האוטו שלי" />
          </Field>

          <Field label="כתובת MAC / UUID">
            <TextField
              value={draft.macAddressOrUuid}
              onChangeText={(v) => setDraft((c) => ({ ...c, macAddressOrUuid: v }))}
              placeholder="00:11:22:33:44:55"
              autoCapitalize="characters"
            />
          </Field>

          <View style={styles.switchRow}>
            <Switch
              value={draft.isVehicle}
              onValueChange={(v) => setDraft((c) => ({ ...c, isVehicle: v }))}
              trackColor={{ true: theme.accent, false: theme.inputBorder }}
              thumbColor="#FFFFFF"
            />
            <Text style={styles.switchLabel}>זהו מכשיר רכב</Text>
          </View>

          <Pressable onPress={() => setDraft(EMPTY_DRAFT)} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>נקה טופס</Text>
          </Pressable>
        </GlassSurface>

        <View style={{ height: spacing.md }} />
      </ScrollView>
    </ModalShell>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    content: { gap: spacing.lg, paddingBottom: spacing.xl },
    notice: { borderRadius: radii.md, borderWidth: 1, borderColor: theme.warning, backgroundColor: theme.dangerSoft, padding: spacing.md },
    noticeText: { color: theme.warning, ...typography.caption, textAlign: "right", lineHeight: 18 },
    section: { padding: spacing.lg, gap: spacing.md },
    sectionTitle: { color: theme.text, ...typography.heading, textAlign: "right" },
    empty: { color: theme.textSecondary, ...typography.body, textAlign: "right" },
    deviceCard: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.glassBorder,
      backgroundColor: theme.chip,
      padding: spacing.md,
      gap: spacing.sm,
    },
    deviceTextBlock: { flex: 1, alignItems: "flex-end", gap: 2 },
    deviceName: { color: theme.text, ...typography.label, fontWeight: "800", textAlign: "right" },
    deviceMeta: { color: theme.textMuted, ...typography.caption, textAlign: "right" },
    deleteButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: theme.dangerSoft },
    deleteText: { color: theme.danger, ...typography.caption, fontWeight: "700" },
    field: { gap: spacing.sm },
    pairedButton: { alignSelf: "flex-end", backgroundColor: theme.chip, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    pairedButtonText: { color: theme.text, ...typography.caption, fontWeight: "700" },
    pairedOption: { borderRadius: radii.sm, backgroundColor: theme.chip, padding: spacing.md },
    pairedOptionText: { color: theme.textSecondary, textAlign: "right" },
    errorText: { color: theme.danger, ...typography.caption, textAlign: "right" },
    switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md },
    switchLabel: { color: theme.text, ...typography.label },
    clearButton: { alignSelf: "flex-end", borderRadius: radii.sm, backgroundColor: theme.chip, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    clearButtonText: { color: theme.text, ...typography.caption, fontWeight: "700" },
  });
}
