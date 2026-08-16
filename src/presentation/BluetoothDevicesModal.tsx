import { useEffect, useMemo, useState } from "react";
import { Modal, PermissionsAndroid, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { BluetoothDevicesModalProps } from "./types";
import { isBluetoothAclDetectionSupported } from "../infrastructure/adapters/AndroidBluetoothClassicTriggerService";

interface DeviceDraft {
  id?: string;
  name: string;
  macAddressOrUuid: string;
  isVehicle: boolean;
}

const EMPTY_DRAFT: DeviceDraft = { name: "", macAddressOrUuid: "", isVehicle: true };

export function BluetoothDevicesModal({ visible, devices, onCancel, onSaveDevice, onDeleteDevice }: BluetoothDevicesModalProps) {
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
    setDraft((current) => ({ ...current, name: device.name || current.name, macAddressOrUuid: device.address }));
  }

  function handleEdit(device: BluetoothDevice) {
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>סגירה</Text>
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>מכשירי בלוטות'</Text>
            <Text style={styles.subtitle}>נהל מכשירים (כמו הרכב) לתזכורות חיבור/ניתוק.</Text>
          </View>
        </View>

        {!canPickPairedDevices ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              זיהוי חיבור אמיתי לרכב עובד רק בבנייה מותקנת (APK), לא בתוך Expo Go. כרגע ניתן להוסיף מכשירים ידנית, אבל
              ההתראה בפועל תתחיל לעבוד אחרי `expo prebuild` + `expo run:android` או בנייה עם EAS.
            </Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מכשירים שמורים</Text>
            {devices.length === 0 ? (
              <Text style={styles.emptyState}>אין מכשירי בלוטות' שמורים עדיין.</Text>
            ) : (
              devices.map((device) => (
                <Pressable key={device.id} onPress={() => handleEdit(device)} style={styles.deviceCard}>
                  <Pressable onPress={() => handleDelete(device.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>מחיקה</Text>
                  </Pressable>
                  <View style={styles.deviceTextBlock}>
                    <Text style={styles.deviceName}>{device.isVehicle ? "🚗 " : ""}{device.name}</Text>
                    <Text style={styles.deviceMeta}>{device.macAddressOrUuid}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.section}>
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

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>שם המכשיר</Text>
              <TextInput
                value={draft.name}
                onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
                placeholder="לדוגמה: האוטו שלי"
                placeholderTextColor="#8B96A8"
                style={styles.input}
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>כתובת MAC / UUID</Text>
              <TextInput
                value={draft.macAddressOrUuid}
                onChangeText={(value) => setDraft((current) => ({ ...current, macAddressOrUuid: value }))}
                placeholder="00:11:22:33:44:55"
                placeholderTextColor="#8B96A8"
                style={styles.input}
                autoCapitalize="characters"
                textAlign="right"
              />
            </View>

            <View style={styles.switchRow}>
              <Switch value={draft.isVehicle} onValueChange={(value) => setDraft((current) => ({ ...current, isVehicle: value }))} />
              <Text style={styles.fieldLabel}>זהו מכשיר רכב</Text>
            </View>

            <View style={styles.formButtons}>
              <Pressable onPress={handleSave} disabled={!canSave || isSaving} style={[styles.saveButton, (!canSave || isSaving) && styles.saveButtonDisabled]}>
                <Text style={styles.saveButtonText}>{isSaving ? "שומר..." : draft.id ? "עדכן מכשיר" : "שמור מכשיר"}</Text>
              </Pressable>
              <Pressable onPress={() => setDraft(EMPTY_DRAFT)} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>נקה טופס</Text>
              </Pressable>
            </View>
          </View>
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
  noticeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4A3A1E",
    backgroundColor: "#241C0E",
    padding: 12,
  },
  noticeText: {
    color: "#F5C842",
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
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
  emptyState: {
    color: "#9AA8BA",
    textAlign: "right",
  },
  deviceCard: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E3045",
    backgroundColor: "#122033",
    padding: 12,
    gap: 8,
  },
  deviceTextBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  deviceName: {
    color: "#F4F7FB",
    fontWeight: "800",
    textAlign: "right",
  },
  deviceMeta: {
    color: "#9AA8BA",
    fontSize: 12,
    textAlign: "right",
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
  pairedButton: {
    alignSelf: "flex-end",
    backgroundColor: "#22344A",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pairedButtonText: {
    color: "#DDE7F2",
    fontWeight: "700",
  },
  pairedOption: {
    borderRadius: 12,
    backgroundColor: "#122033",
    padding: 10,
  },
  pairedOptionText: {
    color: "#DDE7F2",
    textAlign: "right",
  },
  errorText: {
    color: "#FFB8CB",
    textAlign: "right",
    fontSize: 12,
  },
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
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
