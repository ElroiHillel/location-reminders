import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  I18nManager,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CompositionRoot } from "./CompositionRoot";
import { MapPickerModal } from "./MapPickerModal";
import { ReminderEditModal } from "./ReminderEditModal";
import { SettingsModal } from "./SettingsModal";
import { SavedLocationsModal } from "./SavedLocationsModal";
import { BluetoothDevicesModal } from "./BluetoothDevicesModal";
import { LocationSelection, ReminderEditorDraft } from "./types";
import { getTriggerDisplay, isBluetoothTrigger, isSpatialTrigger } from "./triggerDisplay";
import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { Reminder, ReminderStatus } from "../domain/models/Reminder";
import { ParserResult } from "../domain/models/ParserResult";
import { TriggerType } from "../domain/models/TriggerType";
import { SavedLocation } from "../domain/models/SavedLocation";
import { UserSettings } from "../domain/models/UserSettings";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const compositionRoot = new CompositionRoot();

const EMPTY_DRAFT: ReminderEditorDraft = {
  title: "",
  action: "",
  triggerType: TriggerType.NEARBY,
  isRecurring: false,
  radiusMeters: 300,
  parsedLocationQuery: "",
  resolvedLocation: null,
  targetBluetoothDeviceId: null,
  status: "ACTIVE",
};

export default function App() {
  const [query, setQuery] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingReminderId, setEditingReminderId] = useState<string | undefined>();
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [draft, setDraft] = useState<ReminderEditorDraft>(EMPTY_DRAFT);
  const [pendingCreateDraft, setPendingCreateDraft] = useState<ReminderEditorDraft | null>(null);
  const [statusMessage, setStatusMessage] = useState("געו במיקרופון ואמרו תזכורת...");
  const [availableBluetoothDevices, setAvailableBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isManualEntryVisible, setIsManualEntryVisible] = useState(false);
  const [lastSavedReminder, setLastSavedReminder] = useState<Reminder | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSavedLocationsVisible, setIsSavedLocationsVisible] = useState(false);
  const [isBluetoothDevicesVisible, setIsBluetoothDevicesVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    compositionRoot
      .hydrate()
      .then((bootstrap) => {
        if (cancelled) {
          return;
        }

        setReminders(bootstrap.reminders);
        setAvailableBluetoothDevices(bootstrap.bluetoothDevices);
        setSavedLocations(bootstrap.savedLocations);
        setUserSettings(bootstrap.userSettings);
        setStatusMessage("געו במיקרופון ואמרו תזכורת...");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setStatusMessage(error instanceof Error ? error.message : "טעינת הנתונים נכשלה.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  async function refreshReminders() {
    const items = await compositionRoot.reminderRepository.list();
    setReminders(items);
  }

  async function refreshSavedLocations() {
    const items = await compositionRoot.savedLocationRepository.list();
    setSavedLocations(items);
  }

  async function refreshBluetoothDevices() {
    const items = await compositionRoot.bluetoothDeviceRepository.list();
    setAvailableBluetoothDevices(items);
  }

  async function finalizeParsedIntent(text: string) {
    setLastSavedReminder(null);
    setStatusMessage("מנתח את התזכורת...");
    const result = await compositionRoot.parseReminderIntentUseCase.execute({ text, language: "he" });
    setParserResult(result);

    if (result.requiresFallback) {
      const nextDraft = buildDraftFromParserResult(result, text);
      setDraft(nextDraft);
      setEditorMode("create");
      setEditingReminderId(undefined);
      setIsEditorVisible(true);
      setStatusMessage("צריך להשלים כמה פרטים כדי לשמור.");
      return;
    }

    const createResult = await compositionRoot.createReminderUseCase.execute({
      title: result.action || text,
      action: result.action || text,
      triggerType: result.triggerType ?? TriggerType.NEARBY,
      parsedLocationQuery: result.locationTarget ?? undefined,
      parserResult: result,
    });

    await refreshReminders();
    setQuery("");
    setIsManualEntryVisible(false);

    if (createResult.requiresFallback) {
      openEditModal(createResult.reminder);
      setStatusMessage("נשמר, אך צריך להשלים מיקום או מכשיר.");
      return;
    }

    setLastSavedReminder(createResult.reminder);
    setStatusMessage(`נשמר: ${createResult.reminder.title}`);
  }

  async function handleVoicePress() {
    try {
      if (!isRecording) {
        setLastSavedReminder(null);
        setStatusMessage("מקשיב...");
        await compositionRoot.speechToTextService.startRecording("he");
        setIsRecording(true);
        return;
      }

      setIsRecording(false);
      setIsTranscribing(true);
      setStatusMessage("מעבד את הדיבור...");
      const transcription = await compositionRoot.speechToTextService.stopRecording();

      if (!transcription.text.trim()) {
        setStatusMessage(
          userSettings?.geminiApiKey
            ? "לא זוהה דיבור. נסו שוב."
            : "לא זוהה דיבור. הוסיפו מפתח Gemini בהגדרות כדי להפעיל הקלטה קולית.",
        );
        return;
      }

      setQuery(transcription.text);
      await finalizeParsedIntent(transcription.text);
    } catch (error) {
      setIsRecording(false);
      setStatusMessage(error instanceof Error ? error.message : "ההקלטה נכשלה.");
      Alert.alert("שגיאה בהקלטה", error instanceof Error ? error.message : "לא ניתן היה להפעיל את המיקרופון.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleManualSubmit() {
    const text = query.trim();
    if (!text) {
      Alert.alert("חסר טקסט", "נא להקליד תזכורת תחילה.");
      return;
    }

    await finalizeParsedIntent(text);
  }

  async function handleCreateFromMap(location: LocationSelection) {
    setDraft((current) => ({ ...current, resolvedLocation: location, parsedLocationQuery: location.address }));
    setIsMapVisible(false);

    if (!pendingCreateDraft) {
      return;
    }

    const nextDraft = { ...pendingCreateDraft, resolvedLocation: location, parsedLocationQuery: location.address };
    setPendingCreateDraft(null);

    const result = await compositionRoot.createReminderUseCase.execute({
      title: nextDraft.title || nextDraft.action || query,
      action: nextDraft.action || nextDraft.title || query,
      triggerType: nextDraft.triggerType,
      parsedLocationQuery: nextDraft.parsedLocationQuery,
      parserResult: parserResult ?? undefined,
      radiusMeters: nextDraft.radiusMeters,
      isRecurring: nextDraft.isRecurring,
      targetBluetoothDeviceId: nextDraft.targetBluetoothDeviceId,
      manualResolvedLocation: nextDraft.resolvedLocation,
    });

    await refreshReminders();
    setIsEditorVisible(false);
    setLastSavedReminder(result.reminder);
    setStatusMessage(result.requiresFallback ? "התזכורת נשמרה עם מיקום ידני." : "התזכורת נוצרה.");
  }

  async function handleConfirmDraft(nextDraft: ReminderEditorDraft) {
    setDraft(nextDraft);

    if (editorMode === "create") {
      const shouldOpenMapPicker = isSpatialTrigger(nextDraft.triggerType) && !nextDraft.resolvedLocation;
      if (shouldOpenMapPicker) {
        setPendingCreateDraft(nextDraft);
        setIsMapVisible(true);
        setStatusMessage("בחר מיקום על המפה לסיום.");
        return;
      }

      const result = await compositionRoot.createReminderUseCase.execute({
        title: nextDraft.title || nextDraft.action || query,
        action: nextDraft.action || nextDraft.title || query,
        triggerType: nextDraft.triggerType,
        parsedLocationQuery: nextDraft.parsedLocationQuery,
        parserResult: parserResult ?? undefined,
        radiusMeters: nextDraft.radiusMeters,
        isRecurring: nextDraft.isRecurring,
        targetBluetoothDeviceId: nextDraft.targetBluetoothDeviceId,
        manualResolvedLocation: nextDraft.resolvedLocation,
      });

      await refreshReminders();
      setIsEditorVisible(false);
      setLastSavedReminder(result.reminder);
      setStatusMessage(result.requiresFallback ? "התזכורת נשמרה." : "התזכורת נוצרה.");
      return;
    }

    if (!editingReminderId) {
      return;
    }

    await compositionRoot.updateReminderUseCase.execute({
      reminderId: editingReminderId,
      changes: {
        title: nextDraft.title,
        action: nextDraft.action,
        triggerType: nextDraft.triggerType,
        parsedLocationQuery: nextDraft.parsedLocationQuery,
        resolvedLocation: nextDraft.resolvedLocation,
        radiusMeters: nextDraft.radiusMeters,
        isRecurring: nextDraft.isRecurring,
        targetBluetoothDeviceId: nextDraft.targetBluetoothDeviceId,
        status: nextDraft.status,
      },
    });

    await refreshReminders();
    setIsEditorVisible(false);
    setStatusMessage("התזכורת עודכנה.");
  }

  async function handleDeleteReminder(reminder: Reminder) {
    await compositionRoot.reminderRepository.delete(reminder.id);

    if (isSpatialTrigger(reminder.triggerType)) {
      await compositionRoot.geofencingService.unregister(reminder.id);
    }
    if (isBluetoothTrigger(reminder.triggerType)) {
      await compositionRoot.bluetoothTriggerService.unregister(reminder.id);
    }

    if (lastSavedReminder?.id === reminder.id) {
      setLastSavedReminder(null);
    }

    await refreshReminders();
    setStatusMessage("התזכורת נמחקה.");
  }

  async function handleToggleReminderStatus(reminder: Reminder) {
    const nextStatus: ReminderStatus = reminder.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
    await compositionRoot.updateReminderUseCase.execute({
      reminderId: reminder.id,
      changes: { status: nextStatus },
    });
    await refreshReminders();
  }

  async function handleMapSearch(searchQuery: string): Promise<LocationSelection | null> {
    const result = await compositionRoot.geocodingService.geocode({ text: searchQuery, preferredLanguage: "he" });
    if (!result) {
      return null;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    };
  }

  async function handleSaveSettings(settings: UserSettings) {
    const saved = await compositionRoot.updateUserSettings(settings);
    setUserSettings(saved);
  }

  async function handleSaveLocation(location: SavedLocation) {
    await compositionRoot.savedLocationRepository.save(location);
    await refreshSavedLocations();
  }

  async function handleDeleteLocation(locationId: string) {
    await compositionRoot.savedLocationRepository.delete(locationId);
    await refreshSavedLocations();
  }

  async function handleSaveBluetoothDevice(device: BluetoothDevice) {
    await compositionRoot.bluetoothDeviceRepository.save(device);
    await refreshBluetoothDevices();
  }

  async function handleDeleteBluetoothDevice(deviceId: string) {
    await compositionRoot.bluetoothDeviceRepository.delete(deviceId);
    await refreshBluetoothDevices();
  }

  function openCreateModal() {
    setEditorMode("create");
    setEditingReminderId(undefined);
    setParserResult(null);
    setPendingCreateDraft(null);
    setDraft(EMPTY_DRAFT);
    setIsEditorVisible(true);
  }

  function openEditModal(reminder: Reminder) {
    setEditorMode("edit");
    setEditingReminderId(reminder.id);
    setParserResult(null);
    setPendingCreateDraft(null);
    setDraft({
      title: reminder.title,
      action: reminder.action,
      triggerType: reminder.triggerType,
      isRecurring: reminder.isRecurring,
      radiusMeters: reminder.radiusMeters,
      parsedLocationQuery: reminder.parsedLocationQuery ?? "",
      resolvedLocation: reminder.resolvedLocation,
      targetBluetoothDeviceId: reminder.targetBluetoothDeviceId,
      status: reminder.status,
    });
    setIsEditorVisible(true);
  }

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.loadingShell}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#7CDBB6" />
        <Text style={styles.loadingText}>טוען תזכורות...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>תזכורות מבוססות מיקום</Text>
          <View style={styles.topBarActions}>
            <Pressable onPress={openCreateModal} style={styles.topBarIconButton}>
              <Text style={styles.topBarIcon}>➕</Text>
            </Pressable>
            <Pressable onPress={() => setIsBluetoothDevicesVisible(true)} style={styles.topBarIconButton}>
              <Text style={styles.topBarIcon}>🚗</Text>
            </Pressable>
            <Pressable onPress={() => setIsSavedLocationsVisible(true)} style={styles.topBarIconButton}>
              <Text style={styles.topBarIcon}>📍</Text>
            </Pressable>
            <Pressable onPress={() => setIsSettingsVisible(true)} style={styles.topBarIconButton}>
              <Text style={styles.topBarIcon}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>תגיד לי מה לעשות ואיפה, אני כבר אזכיר לך.</Text>
          <Text style={styles.heroSubtitle}>{statusMessage}</Text>

          <View style={styles.micArea}>
            <Animated.View style={[styles.micGlow, isRecording && styles.micGlowActive, { transform: [{ scale: pulseAnim }] }]} />
            <Pressable
              onPress={handleVoicePress}
              disabled={isTranscribing}
              style={[styles.micButton, isRecording && styles.micButtonActive]}
            >
              {isTranscribing ? (
                <ActivityIndicator color="#07111C" />
              ) : (
                <Text style={styles.micIcon}>{isRecording ? "⏹" : "🎙️"}</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => setIsManualEntryVisible((current) => !current)} style={styles.manualToggle}>
            <Text style={styles.manualToggleText}>
              {isManualEntryVisible ? "הסתר הקלדה ידנית" : "⌨️ להקליד במקום לדבר"}
            </Text>
          </Pressable>

          {isManualEntryVisible ? (
            <View style={styles.manualEntryBlock}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="כשאני מגיע לסבתא תזכיר לי..."
                placeholderTextColor="#91A0B1"
                style={styles.promptInput}
                multiline
                textAlign="right"
                textAlignVertical="top"
              />
              <Pressable onPress={handleManualSubmit} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>צור תזכורת</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {lastSavedReminder ? (
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationTextBlock}>
              <Text style={styles.confirmationTitle}>✓ נשמר: {lastSavedReminder.title}</Text>
              <Text style={styles.confirmationMeta}>{getTriggerDisplay(lastSavedReminder.triggerType).label}</Text>
            </View>
            <View style={styles.confirmationActions}>
              <Pressable onPress={() => openEditModal(lastSavedReminder)} style={styles.confirmationEditButton}>
                <Text style={styles.confirmationEditText}>✏️ ערוך</Text>
              </Pressable>
              <Pressable onPress={() => setLastSavedReminder(null)} style={styles.confirmationDismissButton}>
                <Text style={styles.confirmationDismissText}>✕</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>התזכורות שלך</Text>
          <Text style={styles.sectionMeta}>{reminders.length} שמורות</Text>
        </View>

        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const trigger = getTriggerDisplay(item.triggerType);
            const isActive = item.status === "ACTIVE";
            return (
              <Pressable style={styles.reminderCard} onPress={() => openEditModal(item)}>
                <View style={styles.reminderCardTopRow}>
                  <View style={[styles.triggerBadge, { backgroundColor: trigger.backgroundColor }]}>
                    <Text style={styles.triggerBadgeIcon}>{trigger.icon}</Text>
                    <Text style={[styles.triggerBadgeText, { color: trigger.color }]}>{trigger.shortLabel}</Text>
                  </View>
                  <View style={styles.reminderCardActions}>
                    <Pressable onPress={() => handleDeleteReminder(item)} style={styles.cardIconButton}>
                      <Text style={styles.cardIconButtonText}>🗑️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleReminderStatus(item)}
                      style={[styles.statusPill, !isActive && styles.statusPillInactive]}
                    >
                      <Text style={[styles.statusPillText, !isActive && styles.statusPillTextInactive]}>
                        {isActive ? "פעיל" : "מבוטל"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.reminderTitle}>{item.title}</Text>
                <Text style={styles.reminderMeta}>{item.action}</Text>
                <Text style={styles.reminderMeta}>
                  {trigger.label} · רדיוס {item.radiusMeters} מ'
                </Text>
                <Text style={styles.reminderLocation}>
                  {item.parsedLocationQuery || item.resolvedLocation?.address || "אין מיקום מוגדר"}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyState}>אין תזכורות עדיין. נסה להגיד משהו כמו "כשאני מגיע לקניון תקנה חלב".</Text>
          }
        />
      </ScrollView>

      <ReminderEditModal
        visible={isEditorVisible}
        mode={editorMode}
        reminderId={editingReminderId}
        parserResult={parserResult}
        initialDraft={draft}
        availableBluetoothDevices={availableBluetoothDevices}
        onCancel={() => setIsEditorVisible(false)}
        onOpenMapPicker={() => setIsMapVisible(true)}
        onConfirm={handleConfirmDraft}
      />

      <MapPickerModal
        visible={isMapVisible}
        initialQuery={draft.parsedLocationQuery}
        initialLocation={draft.resolvedLocation}
        onCancel={() => setIsMapVisible(false)}
        onSearchLocation={handleMapSearch}
        onConfirm={handleCreateFromMap}
      />

      <SettingsModal
        visible={isSettingsVisible}
        initialSettings={
          userSettings ?? {
            defaultRadiusEnter: 150,
            defaultRadiusExit: 120,
            defaultRadiusNearby: 300,
            nlpProviderPreference: "hybrid",
            geminiApiKey: "",
          }
        }
        onCancel={() => setIsSettingsVisible(false)}
        onSave={handleSaveSettings}
      />

      <SavedLocationsModal
        visible={isSavedLocationsVisible}
        locations={savedLocations}
        onCancel={() => setIsSavedLocationsVisible(false)}
        onSearchLocation={handleMapSearch}
        onSaveLocation={handleSaveLocation}
        onDeleteLocation={handleDeleteLocation}
      />

      <BluetoothDevicesModal
        visible={isBluetoothDevicesVisible}
        devices={availableBluetoothDevices}
        onCancel={() => setIsBluetoothDevicesVisible(false)}
        onSaveDevice={handleSaveBluetoothDevice}
        onDeleteDevice={handleDeleteBluetoothDevice}
      />
    </SafeAreaView>
  );
}

function buildDraftFromParserResult(parserResult: ParserResult, fallbackTitle: string): ReminderEditorDraft {
  return {
    title: parserResult.action || fallbackTitle,
    action: parserResult.action || fallbackTitle,
    triggerType: parserResult.triggerType ?? TriggerType.NEARBY,
    isRecurring: false,
    radiusMeters: 300,
    parsedLocationQuery: parserResult.locationTarget ?? "",
    resolvedLocation: parserResult.matchedSavedLocation
      ? {
          latitude: parserResult.matchedSavedLocation.latitude,
          longitude: parserResult.matchedSavedLocation.longitude,
          address: parserResult.matchedSavedLocation.address,
        }
      : null,
    targetBluetoothDeviceId: parserResult.matchedBluetoothDevice?.id ?? null,
    status: "ACTIVE",
  };
}

const styles = StyleSheet.create({
  loadingShell: {
    flex: 1,
    backgroundColor: "#07111C",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#9AA8BA",
    fontSize: 16,
  },
  shell: {
    flex: 1,
    backgroundColor: "#07111C",
    direction: "rtl",
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  topBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarTitle: {
    color: "#F4F7FB",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  topBarActions: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  topBarIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0F1A2A",
    borderWidth: 1,
    borderColor: "#1E3045",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarIcon: {
    fontSize: 16,
  },
  heroCard: {
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#0F1A2A",
    borderWidth: 1,
    borderColor: "#1E3045",
    gap: 16,
    alignItems: "center",
  },
  heroTitle: {
    color: "#F4F7FB",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#9AA8BA",
    textAlign: "center",
  },
  micArea: {
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  micGlow: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: "rgba(124, 219, 182, 0.16)",
  },
  micGlowActive: {
    backgroundColor: "rgba(240, 108, 108, 0.18)",
  },
  micButton: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "#7CDBB6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7CDBB6",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: "#F06C6C",
    shadowColor: "#F06C6C",
  },
  micIcon: {
    fontSize: 44,
  },
  manualToggle: {
    paddingVertical: 6,
  },
  manualToggleText: {
    color: "#7CDBB6",
    fontWeight: "700",
    fontSize: 13,
  },
  manualEntryBlock: {
    width: "100%",
    gap: 12,
  },
  promptInput: {
    minHeight: 74,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#122033",
    color: "#F4F7FB",
    borderWidth: 1,
    borderColor: "#20324A",
    writingDirection: "rtl",
  },
  primaryButton: {
    backgroundColor: "#7CDBB6",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#07111C",
    fontWeight: "800",
  },
  confirmationCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#12261F",
    borderWidth: 1,
    borderColor: "#2C5744",
    gap: 10,
  },
  confirmationTextBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  confirmationTitle: {
    color: "#7CDBB6",
    fontWeight: "800",
    textAlign: "right",
  },
  confirmationMeta: {
    color: "#9AA8BA",
    fontSize: 12,
    textAlign: "right",
  },
  confirmationActions: {
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
  },
  confirmationEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#1D3044",
  },
  confirmationEditText: {
    color: "#F4F7FB",
    fontWeight: "700",
    fontSize: 12,
  },
  confirmationDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationDismissText: {
    color: "#9AA8BA",
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sectionTitle: {
    color: "#F4F7FB",
    fontSize: 22,
    fontWeight: "800",
  },
  sectionMeta: {
    color: "#9AA8BA",
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  reminderCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#0E1827",
    borderWidth: 1,
    borderColor: "#1E3045",
    gap: 8,
  },
  reminderCardTopRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reminderCardActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  cardIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A2638",
  },
  cardIconButtonText: {
    fontSize: 13,
  },
  triggerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  triggerBadgeIcon: {
    fontSize: 14,
  },
  triggerBadgeText: {
    fontWeight: "800",
    fontSize: 13,
  },
  reminderTitle: {
    color: "#F4F7FB",
    fontWeight: "800",
    fontSize: 17,
    textAlign: "right",
  },
  statusPill: {
    color: "#07111C",
    backgroundColor: "#7CDBB6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  statusPillInactive: {
    backgroundColor: "#2A2233",
  },
  statusPillText: {
    color: "#07111C",
    fontSize: 12,
    fontWeight: "800",
  },
  statusPillTextInactive: {
    color: "#C9B8E0",
  },
  reminderMeta: {
    color: "#9AA8BA",
    textAlign: "right",
  },
  reminderLocation: {
    color: "#7CDBB6",
    textAlign: "right",
    fontWeight: "600",
  },
  emptyState: {
    color: "#9AA8BA",
    paddingVertical: 20,
    textAlign: "right",
    lineHeight: 24,
  },
});
