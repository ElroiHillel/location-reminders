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

type StatusFilter = "all" | "active" | "done";

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { theme, mode, preference, setPreference } = useTheme();
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
  const [lastSavedReminder, setLastSavedReminder] = useState<Reminder | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSavedLocationsVisible, setIsSavedLocationsVisible] = useState(false);
  const [isBluetoothDevicesVisible, setIsBluetoothDevicesVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const pulse = useRef(new Animated.Value(0)).current;

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

  const activeNotificationStyle = userSettings?.defaultNotificationStyle ?? NotificationStyle.SOUND;

  async function finalizeParsedIntent(text: string) {
    setLastSavedReminder(null);
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
    setLastSavedReminder(createResult.reminder);
    setStatusMessage(`נשמר: ${createResult.reminder.title}`);
  }

  async function handleVoicePress() {
    try {
      if (!isRecording) {
        hapticMedium();
        setLastSavedReminder(null);
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
            : "לא זוהה דיבור. הוסף מפתח Gemini בהגדרות כדי להפעיל הקלטה קולית.",
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
        notificationStyle: nextDraft.notificationStyle,
      });

      await refreshReminders();
      setIsEditorVisible(false);
      hapticSuccess();
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
        notificationStyle: nextDraft.notificationStyle,
        status: nextDraft.status,
      },
    });

    await refreshReminders();
    setIsEditorVisible(false);
    hapticSuccess();
    setStatusMessage("התזכורת עודכנה.");
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

    if (lastSavedReminder?.id === reminder.id) {
      setLastSavedReminder(null);
    }

    await refreshReminders();
    setStatusMessage("התזכורת נמחקה.");
  }

  async function handleToggleReminderStatus(reminder: Reminder) {
    hapticSelection();
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
    return { latitude: result.latitude, longitude: result.longitude, address: result.address };
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

  function cycleTheme() {
    hapticSelection();
    setPreference(mode === "dark" ? "light" : "dark");
  }

  const visibleReminders = useMemo(
    () => filterAndSortReminders(reminders, searchText, statusFilter),
    [reminders, searchText, statusFilter],
  );
  const activeCount = useMemo(() => reminders.filter((item) => item.status === "ACTIVE").length, [reminders]);

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

  const ringOne = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
  };
  const ringTwo = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>תזכורות חכמות</Text>
            </View>
            <View style={styles.topBarActions}>
              <IconButton icon={mode === "dark" ? "☀️" : "🌙"} onPress={cycleTheme} />
              <IconButton icon="📍" onPress={() => { hapticLight(); setIsSavedLocationsVisible(true); }} />
              <IconButton icon="🚗" onPress={() => { hapticLight(); setIsBluetoothDevicesVisible(true); }} />
              <IconButton icon="⚙️" onPress={() => { hapticLight(); setIsSettingsVisible(true); }} />
            </View>
          </View>

          {/* Hero / mic */}
          <GlassSurface strong radius={radii.xxl} style={styles.heroCard}>
            <Text style={styles.heroTitle}>תגיד מה ואיפה — אני אזכיר</Text>
            <Text style={styles.heroSubtitle}>{statusMessage}</Text>

            <View style={styles.micArea}>
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

            <Pressable onPress={() => { hapticSelection(); setIsManualEntryVisible((v) => !v); }} style={styles.manualToggle}>
              <Text style={styles.manualToggleText}>
                {isManualEntryVisible ? "הסתר הקלדה" : "⌨️  להקליד במקום לדבר"}
              </Text>
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
          </GlassSurface>

          {/* Saved confirmation */}
          {lastSavedReminder ? (
            <GlassSurface radius={radii.lg} style={[styles.confirmCard, { borderColor: theme.accent }]}>
              <View style={styles.confirmTextBlock}>
                <Text style={styles.confirmTitle}>✓ נשמר: {lastSavedReminder.title}</Text>
                <Text style={styles.confirmMeta}>{getTriggerDisplay(lastSavedReminder.triggerType).label}</Text>
              </View>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => openEditModal(lastSavedReminder)} style={styles.confirmEdit}>
                  <Text style={styles.confirmEditText}>✏️ ערוך</Text>
                </Pressable>
                <Pressable onPress={() => { hapticSelection(); setLastSavedReminder(null); }} style={styles.confirmDismiss}>
                  <Text style={styles.confirmDismissText}>✕</Text>
                </Pressable>
              </View>
            </GlassSurface>
          ) : null}

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>התזכורות שלך</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{activeCount} פעילות</Text>
            </View>
          </View>

          {/* Search + filters */}
          {reminders.length > 0 ? (
            <View style={styles.controlsBlock}>
              <View style={styles.searchRow}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="חיפוש תזכורת..."
                  placeholderTextColor={theme.textMuted}
                  style={styles.searchInput}
                  textAlign="right"
                />
                {searchText ? (
                  <Pressable onPress={() => setSearchText("")} hitSlop={8}>
                    <Text style={styles.searchClear}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.filterRow}>
                {([
                  ["all", "הכל"],
                  ["active", "פעילות"],
                  ["done", "בוצעו"],
                ] as [StatusFilter, string][]).map(([value, label]) => {
                  const selected = statusFilter === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => { hapticSelection(); setStatusFilter(value); }}
                      style={[styles.filterChip, selected && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Reminder list */}
          {visibleReminders.length > 0 ? (
            <View style={styles.list}>
              {visibleReminders.map((item) => (
                <ReminderCard
                  key={item.id}
                  reminder={item}
                  theme={theme}
                  styles={styles}
                  onPress={() => openEditModal(item)}
                  onDelete={() => handleDeleteReminder(item)}
                  onToggle={() => handleToggleReminderStatus(item)}
                />
              ))}
            </View>
          ) : (
            <GlassSurface radius={radii.lg} style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>{reminders.length === 0 ? "🎙️" : "🔍"}</Text>
              <Text style={styles.emptyText}>
                {reminders.length === 0
                  ? 'אין תזכורות עדיין. נסה לומר "כשאני מגיע לקניון תקנה חלב".'
                  : "לא נמצאו תזכורות שמתאימות לחיפוש."}
              </Text>
            </GlassSurface>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>

        {/* Floating add button */}
        <Pressable onPress={openCreateModal} style={styles.fab}>
          <GlassSurface strong radius={radii.pill} style={styles.fabInner}>
            <Text style={styles.fabIcon}>＋</Text>
          </GlassSurface>
        </Pressable>
      </SafeAreaView>

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
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles_iconButton = {
  width: 42,
  height: 42,
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
        <LinearGradientCircle colors={colors} />
        <View style={micStyles.center}>
          {isTranscribing ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={micStyles.icon}>{isRecording ? "⏹" : "🎙️"}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function LinearGradientCircle({ colors }: { colors: readonly [string, string] }) {
  return <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={micStyles.gradient} />;
}

const micStyles = StyleSheet.create({
  wrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  gradientWrap: { width: 124, height: 124, borderRadius: 62, overflow: "hidden" },
  gradient: { ...StyleSheet.absoluteFillObject },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 48 },
});

function ReminderCard({
  reminder,
  theme,
  styles,
  onPress,
  onDelete,
  onToggle,
}: {
  reminder: Reminder;
  theme: ThemePalette;
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
              <Text style={[styles.statusPillText, !isActive && styles.statusPillTextInactive]}>
                {isActive ? "פעיל" : "מבוטל"}
              </Text>
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
          {isSpatialTrigger(reminder.triggerType) ? (
            <Text style={styles.reminderRadius}>{reminder.radiusMeters} מ'</Text>
          ) : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

function filterAndSortReminders(reminders: Reminder[], search: string, statusFilter: StatusFilter): Reminder[] {
  const term = search.trim().toLowerCase();
  const filtered = reminders.filter((reminder) => {
    if (statusFilter === "active" && reminder.status !== "ACTIVE") {
      return false;
    }
    if (statusFilter === "done" && reminder.status === "ACTIVE") {
      return false;
    }
    if (!term) {
      return true;
    }
    const haystack = [reminder.title, reminder.action, reminder.parsedLocationQuery ?? "", reminder.resolvedLocation?.address ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  return filtered.sort((a, b) => {
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
    container: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },

    topBar: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
    brandRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
    brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.accent },
    brandText: { color: theme.text, ...typography.heading, fontWeight: "800" },
    topBarActions: { flexDirection: "row-reverse", gap: spacing.sm },

    heroCard: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.md },
    heroTitle: { color: theme.text, ...typography.hero, textAlign: "center" },
    heroSubtitle: { color: theme.textSecondary, ...typography.body, textAlign: "center", minHeight: 22 },

    micArea: { width: 168, height: 168, alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
    micRing: { position: "absolute", top: 22, left: 22, width: 124, height: 124, borderRadius: 62, borderWidth: 2 },
    micPressable: { alignItems: "center", justifyContent: "center" },

    manualToggle: { paddingVertical: spacing.xs },
    manualToggleText: { color: theme.accent, ...typography.label },
    manualBlock: { width: "100%", gap: spacing.md },
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

    confirmCard: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, gap: spacing.md },
    confirmTextBlock: { flex: 1, alignItems: "flex-end", gap: 2 },
    confirmTitle: { color: theme.accent, ...typography.heading, fontWeight: "800", textAlign: "right" },
    confirmMeta: { color: theme.textSecondary, ...typography.caption, textAlign: "right" },
    confirmActions: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
    confirmEdit: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: theme.chip },
    confirmEditText: { color: theme.text, ...typography.caption },
    confirmDismiss: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    confirmDismissText: { color: theme.textMuted, ...typography.heading },

    sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    sectionTitle: { color: theme.text, ...typography.title },
    sectionBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: theme.accentSoft },
    sectionBadgeText: { color: theme.accent, ...typography.caption },

    controlsBlock: { gap: spacing.sm },
    searchRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
    searchIcon: { fontSize: 14, opacity: 0.7 },
    searchInput: { flex: 1, color: theme.text, paddingVertical: spacing.md, ...typography.body, writingDirection: "rtl" },
    searchClear: { color: theme.textMuted, fontSize: 14, paddingHorizontal: spacing.xs },
    filterRow: { flexDirection: "row-reverse", gap: spacing.sm },
    filterChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: theme.chip,
      borderWidth: 1,
      borderColor: "transparent",
    },
    filterChipActive: { backgroundColor: theme.chipActive, borderColor: theme.accent },
    filterChipText: { color: theme.textSecondary, ...typography.caption },
    filterChipTextActive: { color: theme.accent },

    list: { gap: spacing.md },
    reminderCard: { padding: spacing.lg, gap: spacing.sm },
    reminderCardInactive: { opacity: 0.62 },
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

    emptyCard: { padding: spacing.xxl, alignItems: "center", gap: spacing.md },
    emptyEmoji: { fontSize: 40 },
    emptyText: { color: theme.textSecondary, ...typography.body, textAlign: "center", lineHeight: 24 },

    fab: { position: "absolute", bottom: spacing.xl, left: spacing.xl },
    fabInner: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
    fabIcon: { color: theme.text, fontSize: 32, fontWeight: "300", lineHeight: 34 },
  });
}
