import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { LinearGradient } from "expo-linear-gradient";
import { CompositionRoot } from "./CompositionRoot";
import { MapPickerModal } from "./MapPickerModal";
import { ReminderEditModal } from "./ReminderEditModal";
import { SettingsModal } from "./SettingsModal";
import { SavedLocationsModal } from "./SavedLocationsModal";
import { BluetoothDevicesModal } from "./BluetoothDevicesModal";
import { ReminderConfirmationSheet } from "./ReminderConfirmationSheet";
import { LocationSelection, ReminderEditorDraft } from "./types";
import { getTriggerDisplay, isBluetoothTrigger, isSpatialTrigger } from "./triggerDisplay";
import { getNotificationStyleDisplay } from "./notificationStyleDisplay";
import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { Reminder, ReminderStatus } from "../domain/models/Reminder";
import { ParserResult } from "../domain/models/ParserResult";
import { TriggerType } from "../domain/models/TriggerType";
import { SavedLocation } from "../domain/models/SavedLocation";
import { UserSettings } from "../domain/models/UserSettings";
import { NotificationStyle } from "../domain/models/NotificationStyle";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { ThemePalette, radii, spacing, typography } from "./theme/tokens";
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess, hapticWarning } from "./theme/haptics";
import { AuroraBackground } from "./components/AuroraBackground";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const compositionRoot = new CompositionRoot();

const DEFAULT_SETTINGS: UserSettings = {
  defaultRadiusEnter: 150,
  defaultRadiusExit: 120,
  defaultRadiusNearby: 300,
  nlpProviderPreference: "hybrid",
  geminiApiKey: "",
  defaultNotificationStyle: NotificationStyle.SOUND,
};

const EMPTY_DRAFT: ReminderEditorDraft = {
  title: "",
  action: "",
  triggerType: TriggerType.NEARBY,
  isRecurring: false,
  radiusMeters: 300,
  parsedLocationQuery: "",
  resolvedLocation: null,
  targetBluetoothDeviceId: null,
  notificationStyle: NotificationStyle.SOUND,
  status: "ACTIVE",
};

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { theme, mode, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const [statusMessage, setStatusMessage] = useState("גע במיקרופון ואמור תזכורת");
  const [availableBluetoothDevices, setAvailableBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isManualEntryVisible, setIsManualEntryVisible] = useState(false);
  const [confirmReminder, setConfirmReminder] = useState<Reminder | null>(null);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSavedLocationsVisible, setIsSavedLocationsVisible] = useState(false);
  const [isBluetoothDevicesVisible, setIsBluetoothDevicesVisible] = useState(false);

  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

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
        setStatusMessage("גע במיקרופון ואמור תזכורת");
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : "טעינת הנתונים נכשלה.");
        }
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

  // Idle premium motion: a slowly rotating halo that gently breathes.
  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    );
    const breatheLoop = Animated.loop(
      Animated.timing(breathe, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    spinLoop.start();
    breatheLoop.start();
    return () => {
      spinLoop.stop();
      breatheLoop.stop();
    };
  }, [spin, breathe]);

  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  async function refreshReminders() {
    setReminders(await compositionRoot.reminderRepository.list());
  }
  async function refreshSavedLocations() {
    setSavedLocations(await compositionRoot.savedLocationRepository.list());
  }
  async function refreshBluetoothDevices() {
    setAvailableBluetoothDevices(await compositionRoot.bluetoothDeviceRepository.list());
  }

  const activeNotificationStyle = userSettings?.defaultNotificationStyle ?? NotificationStyle.SOUND;

  async function finalizeParsedIntent(text: string) {
    setStatusMessage("מנתח את התזכורת...");
    const result = await compositionRoot.parseReminderIntentUseCase.execute({ text, language: "he" });
    setParserResult(result);

    if (result.requiresFallback) {
      const nextDraft = buildDraftFromParserResult(result, text, activeNotificationStyle);
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

    hapticSuccess();
    setStatusMessage("גע במיקרופון ואמור תזכורת");
    setConfirmReminder(createResult.reminder);
    setIsConfirmVisible(true);
  }

  async function handleVoicePress() {
    try {
      if (!isRecording) {
        hapticMedium();
        setStatusMessage("מקשיב...");
        await compositionRoot.speechToTextService.startRecording("he");
        setIsRecording(true);
        return;
      }

      hapticLight();
      setIsRecording(false);
      setIsTranscribing(true);
      setStatusMessage("מעבד את הדיבור...");
      const transcription = await compositionRoot.speechToTextService.stopRecording();

      if (!transcription.text.trim()) {
        setStatusMessage(
          userSettings?.geminiApiKey
            ? "לא זוהה דיבור. נסה שוב."
            : "לא זוהה דיבור. הוסף מפתח Gemini בהגדרות.",
        );
        return;
      }

      setQuery(transcription.text);
      await finalizeParsedIntent(transcription.text);
    } catch (error) {
      setIsRecording(false);
      hapticWarning();
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
      notificationStyle: nextDraft.notificationStyle,
    });
    await refreshReminders();
    setIsEditorVisible(false);
    hapticSuccess();
    setConfirmReminder(result.reminder);
    setIsConfirmVisible(true);
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
        notificationStyle: nextDraft.notificationStyle,
      });
      await refreshReminders();
      setIsEditorVisible(false);
      hapticSuccess();
      setStatusMessage("התזכורת נוצרה.");
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
        notificationStyle: nextDraft.notificationStyle,
        status: nextDraft.status,
      },
    });
    await refreshReminders();
    setIsEditorVisible(false);
    hapticSuccess();
    setStatusMessage("התזכורת עודכנה.");
  }

  async function handleConfirmStyleChange(style: NotificationStyle) {
    if (!confirmReminder) {
      return;
    }
    const updated = { ...confirmReminder, notificationStyle: style };
    setConfirmReminder(updated);
    await compositionRoot.updateReminderUseCase.execute({
      reminderId: confirmReminder.id,
      changes: { notificationStyle: style },
    });
    await refreshReminders();
  }

  function handleEditFromConfirm() {
    const reminder = confirmReminder;
    setIsConfirmVisible(false);
    if (reminder) {
      openEditModal(reminder);
    }
  }

  async function handleDeleteReminder(reminder: Reminder) {
    hapticWarning();
    await compositionRoot.reminderRepository.delete(reminder.id);
    if (isSpatialTrigger(reminder.triggerType)) {
      await compositionRoot.geofencingService.unregister(reminder.id);
    }
    if (isBluetoothTrigger(reminder.triggerType)) {
      await compositionRoot.bluetoothTriggerService.unregister(reminder.id);
    }
    await refreshReminders();
    setStatusMessage("התזכורת נמחקה.");
  }

  async function handleToggleReminderStatus(reminder: Reminder) {
    hapticSelection();
    const nextStatus: ReminderStatus = reminder.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
    await compositionRoot.updateReminderUseCase.execute({ reminderId: reminder.id, changes: { status: nextStatus } });
    await refreshReminders();
  }

  async function handleMapSearch(searchQuery: string): Promise<LocationSelection | null> {
    const result = await compositionRoot.geocodingService.geocode({ text: searchQuery, preferredLanguage: "he" });
    return result ? { latitude: result.latitude, longitude: result.longitude, address: result.address } : null;
  }

  async function handleSaveSettings(settings: UserSettings) {
    setUserSettings(await compositionRoot.updateUserSettings(settings));
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
    hapticLight();
    setEditorMode("create");
    setEditingReminderId(undefined);
    setParserResult(null);
    setPendingCreateDraft(null);
    setDraft({ ...EMPTY_DRAFT, notificationStyle: activeNotificationStyle });
    setIsEditorVisible(true);
  }

  function openEditModal(reminder: Reminder) {
    hapticLight();
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
      notificationStyle: reminder.notificationStyle,
      status: reminder.status,
    });
    setIsEditorVisible(true);
  }

  const sortedReminders = useMemo(() => sortReminders(reminders), [reminders]);
  const activeCount = useMemo(() => reminders.filter((item) => item.status === "ACTIVE").length, [reminders]);
  const confirmDeviceName = useMemo(
    () => availableBluetoothDevices.find((device) => device.id === confirmReminder?.targetBluetoothDeviceId)?.name ?? null,
    [availableBluetoothDevices, confirmReminder],
  );

  if (isHydrating) {
    return (
      <View style={styles.loadingShell}>
        <AuroraBackground />
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>טוען תזכורות...</Text>
      </View>
    );
  }

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] });
  const ringOne = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
  };
  const ringTwo = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Minimal top bar */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>תזכורות</Text>
            </View>
            <View style={styles.topBarActions}>
              <IconButton icon={mode === "dark" ? "☀️" : "🌙"} onPress={() => { hapticSelection(); setPreference(mode === "dark" ? "light" : "dark"); }} />
              <IconButton icon="📍" onPress={() => { hapticLight(); setIsSavedLocationsVisible(true); }} />
              <IconButton icon="🚗" onPress={() => { hapticLight(); setIsBluetoothDevicesVisible(true); }} />
              <IconButton icon="⚙️" onPress={() => { hapticLight(); setIsSettingsVisible(true); }} />
            </View>
          </View>

          {/* Hero mic — clean, centered, animated */}
          <View style={styles.hero}>
            <View style={styles.micArea}>
              <Animated.View style={[styles.halo, { transform: [{ rotate: spinDeg }, { scale: breatheScale }] }]}>
                <LinearGradient
                  colors={[theme.accentGradientStart, theme.accentAltEnd, theme.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.haloFill}
                />
              </Animated.View>

              {isRecording ? (
                <>
                  <Animated.View style={[styles.micRing, { borderColor: theme.danger }, ringOne]} />
                  <Animated.View style={[styles.micRing, { borderColor: theme.danger }, ringTwo]} />
                </>
              ) : null}

              <Pressable onPress={handleVoicePress} disabled={isTranscribing} style={styles.micPressable}>
                <MicButton theme={theme} isRecording={isRecording} isTranscribing={isTranscribing} />
              </Pressable>
            </View>

            <Text style={styles.heroStatus}>{statusMessage}</Text>

            <Pressable onPress={() => { hapticSelection(); setIsManualEntryVisible((v) => !v); }} hitSlop={8}>
              <Text style={styles.manualToggle}>{isManualEntryVisible ? "הסתר הקלדה" : "⌨️  להקליד במקום"}</Text>
            </Pressable>

            {isManualEntryVisible ? (
              <View style={styles.manualBlock}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="כשאני מגיע לסבתא תזכיר לי..."
                  placeholderTextColor={theme.textMuted}
                  style={styles.promptInput}
                  multiline
                  textAlign="right"
                  textAlignVertical="top"
                />
                <GradientButton label="צור תזכורת" onPress={handleManualSubmit} />
              </View>
            ) : null}
          </View>

          {/* Reminders */}
          {reminders.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>התזכורות שלך</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{activeCount} פעילות</Text>
              </View>
            </View>
          ) : null}

          {sortedReminders.length > 0 ? (
            <View style={styles.list}>
              {sortedReminders.map((item) => (
                <ReminderCard
                  key={item.id}
                  reminder={item}
                  styles={styles}
                  onPress={() => openEditModal(item)}
                  onDelete={() => handleDeleteReminder(item)}
                  onToggle={() => handleToggleReminderStatus(item)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>אין תזכורות עדיין. גע במיקרופון ואמור מה להזכיר לך ואיפה.</Text>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>

        <Pressable onPress={openCreateModal} style={styles.fab}>
          <GlassSurface strong radius={radii.pill} style={styles.fabInner}>
            <Text style={styles.fabIcon}>＋</Text>
          </GlassSurface>
        </Pressable>
      </SafeAreaView>

      <ReminderConfirmationSheet
        visible={isConfirmVisible}
        reminder={confirmReminder}
        deviceName={confirmDeviceName}
        onChangeStyle={handleConfirmStyleChange}
        onEdit={handleEditFromConfirm}
        onClose={() => setIsConfirmVisible(false)}
      />

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
        initialSettings={userSettings ?? DEFAULT_SETTINGS}
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
    </View>
  );
}

function IconButton({ icon, onPress }: { icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <GlassSurface radius={radii.pill} style={styles_iconButton}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles_iconButton = {
  width: 40,
  height: 40,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

function MicButton({ theme, isRecording, isTranscribing }: { theme: ThemePalette; isRecording: boolean; isTranscribing: boolean }) {
  const colors = isRecording
    ? ([theme.danger, theme.accentAltEnd] as const)
    : ([theme.accentGradientStart, theme.accentGradientEnd] as const);
  return (
    <View style={micStyles.wrap}>
      <View style={micStyles.gradientWrap}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={micStyles.gradient} />
        <View style={micStyles.center}>
          {isTranscribing ? <ActivityIndicator color={theme.onAccent} /> : <Text style={micStyles.icon}>{isRecording ? "⏹" : "🎙️"}</Text>}
        </View>
      </View>
    </View>
  );
}

const micStyles = StyleSheet.create({
  wrap: { width: 128, height: 128, alignItems: "center", justifyContent: "center" },
  gradientWrap: { width: 120, height: 120, borderRadius: 60, overflow: "hidden" },
  gradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 46 },
});

function ReminderCard({
  reminder,
  styles,
  onPress,
  onDelete,
  onToggle,
}: {
  reminder: Reminder;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const trigger = getTriggerDisplay(reminder.triggerType);
  const notif = getNotificationStyleDisplay(reminder.notificationStyle);
  const isActive = reminder.status === "ACTIVE";
  return (
    <Pressable onPress={onPress}>
      <GlassSurface radius={radii.lg} style={[styles.reminderCard, !isActive && styles.reminderCardInactive]}>
        <View style={styles.reminderTopRow}>
          <View style={styles.reminderBadges}>
            <View style={[styles.triggerBadge, { backgroundColor: trigger.backgroundColor }]}>
              <Text style={styles.triggerBadgeIcon}>{trigger.icon}</Text>
              <Text style={[styles.triggerBadgeText, { color: trigger.color }]}>{trigger.shortLabel}</Text>
            </View>
            <Text style={styles.notifIcon}>{notif.icon}</Text>
          </View>
          <View style={styles.reminderActions}>
            <Pressable onPress={onDelete} hitSlop={6} style={styles.cardIconButton}>
              <Text style={styles.cardIconText}>🗑️</Text>
            </Pressable>
            <Pressable onPress={onToggle} hitSlop={6} style={[styles.statusPill, !isActive && styles.statusPillInactive]}>
              <Text style={[styles.statusPillText, !isActive && styles.statusPillTextInactive]}>{isActive ? "פעיל" : "מבוטל"}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.reminderTitle}>{reminder.title}</Text>
        {reminder.action && reminder.action !== reminder.title ? (
          <Text style={styles.reminderMeta}>{reminder.action}</Text>
        ) : null}
        <View style={styles.reminderFooter}>
          <Text style={styles.reminderLocation} numberOfLines={1}>
            📍 {reminder.parsedLocationQuery || reminder.resolvedLocation?.address || "אין מיקום"}
          </Text>
          {isSpatialTrigger(reminder.triggerType) ? <Text style={styles.reminderRadius}>{reminder.radiusMeters} מ'</Text> : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "ACTIVE" ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function buildDraftFromParserResult(
  parserResult: ParserResult,
  fallbackTitle: string,
  defaultNotificationStyle: NotificationStyle,
): ReminderEditorDraft {
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
    notificationStyle: defaultNotificationStyle,
    status: "ACTIVE",
  };
}

function createStyles(theme: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg, direction: "rtl" },
    safe: { flex: 1 },
    loadingShell: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: theme.bg },
    loadingText: { color: theme.textSecondary, ...typography.body },
    container: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },

    topBar: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
    brandRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
    brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
    brandText: { color: theme.text, ...typography.heading, fontWeight: "800" },
    topBarActions: { flexDirection: "row-reverse", gap: spacing.sm },

    hero: { alignItems: "center", gap: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
    micArea: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
    halo: { position: "absolute", width: 176, height: 176, borderRadius: 88, overflow: "hidden", opacity: 0.5 },
    haloFill: { flex: 1 },
    micRing: { position: "absolute", width: 128, height: 128, borderRadius: 64, borderWidth: 2 },
    micPressable: { alignItems: "center", justifyContent: "center" },
    heroStatus: { color: theme.textSecondary, ...typography.body, textAlign: "center", minHeight: 22 },
    manualToggle: { color: theme.textMuted, ...typography.caption, fontWeight: "700" },
    manualBlock: { width: "100%", gap: spacing.md, marginTop: spacing.xs },
    promptInput: {
      minHeight: 76,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.inputBg,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      writingDirection: "rtl",
      ...typography.body,
    },

    sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { color: theme.text, ...typography.title },
    sectionBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: theme.accentSoft },
    sectionBadgeText: { color: theme.accent, ...typography.caption },

    list: { gap: spacing.md },
    reminderCard: { padding: spacing.lg, gap: spacing.sm },
    reminderCardInactive: { opacity: 0.6 },
    reminderTopRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
    reminderBadges: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
    triggerBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
    triggerBadgeIcon: { fontSize: 13 },
    triggerBadgeText: { ...typography.caption, fontWeight: "800" },
    notifIcon: { fontSize: 14 },
    reminderActions: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
    cardIconButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.chip },
    cardIconText: { fontSize: 13 },
    statusPill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: theme.accent },
    statusPillInactive: { backgroundColor: theme.chip },
    statusPillText: { color: theme.onAccent, ...typography.caption, fontWeight: "800" },
    statusPillTextInactive: { color: theme.textMuted },
    reminderTitle: { color: theme.text, ...typography.heading, fontWeight: "800", textAlign: "right" },
    reminderMeta: { color: theme.textSecondary, ...typography.body, textAlign: "right" },
    reminderFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    reminderLocation: { color: theme.accent, ...typography.caption, fontWeight: "700", flex: 1, textAlign: "right" },
    reminderRadius: { color: theme.textMuted, ...typography.caption },

    emptyText: { color: theme.textSecondary, ...typography.body, textAlign: "center", lineHeight: 24, paddingHorizontal: spacing.xl },

    fab: { position: "absolute", bottom: spacing.xl, left: spacing.xl },
    fabInner: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
    fabIcon: { color: theme.text, fontSize: 32, fontWeight: "300", lineHeight: 34 },
  });
}
