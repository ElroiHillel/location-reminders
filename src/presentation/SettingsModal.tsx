import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingsModalProps } from "./types";
import { UserSettings } from "../domain/models/UserSettings";
import { getNotificationStyleDisplay, NOTIFICATION_STYLE_OPTIONS } from "./notificationStyleDisplay";
import { useTheme, ThemePreference } from "./theme/ThemeContext";
import { spacing, radii, typography } from "./theme/tokens";
import { ModalShell } from "./components/ModalShell";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { Field, TextField, SelectableCard } from "./components/FormControls";
import { hapticSelection } from "./theme/haptics";

const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";
const DEFAULT_MODEL_PLACEHOLDER = "gemini-flash-latest";

const MODE_OPTIONS: { value: UserSettings["nlpProviderPreference"]; label: string; help: string }[] = [
  { value: "hybrid", label: "היברידי (מומלץ)", help: "מנסה קודם ניתוח מקומי חינמי, ופונה ל-Gemini רק כשצריך." },
  { value: "local", label: "מקומי בלבד", help: "לא שולח כלום לאינטרנט, אך פחות מדויק עם ניסוחים חופשיים." },
  { value: "gemini", label: "Gemini בלבד", help: "הכי מדויק, אבל דורש מפתח API ושולח את הטקסט ל-Google." },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "system", label: "מערכת", icon: "📱" },
  { value: "dark", label: "כהה", icon: "🌙" },
  { value: "light", label: "בהיר", icon: "☀️" },
];

export function SettingsModal({ visible, initialSettings, onCancel, onSave }: SettingsModalProps) {
  const { theme, preference, setPreference } = useTheme();
  const styles = createStyles(theme);

  const [apiKey, setApiKey] = useState(initialSettings.geminiApiKey ?? "");
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [mode, setMode] = useState<UserSettings["nlpProviderPreference"]>(initialSettings.nlpProviderPreference);
  const [model, setModel] = useState(initialSettings.geminiModel ?? "");
  const [googleKey, setGoogleKey] = useState(initialSettings.googlePlacesApiKey ?? "");
  const [isGoogleKeyVisible, setIsGoogleKeyVisible] = useState(false);
  const [notificationStyle, setNotificationStyle] = useState(initialSettings.defaultNotificationStyle);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setApiKey(initialSettings.geminiApiKey ?? "");
      setMode(initialSettings.nlpProviderPreference);
      setModel(initialSettings.geminiModel ?? "");
      setGoogleKey(initialSettings.googlePlacesApiKey ?? "");
      setNotificationStyle(initialSettings.defaultNotificationStyle);
      setIsKeyVisible(false);
      setIsGoogleKeyVisible(false);
    }
  }, [visible, initialSettings]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        ...initialSettings,
        geminiApiKey: apiKey.trim(),
        nlpProviderPreference: mode,
        geminiModel: model.trim(),
        googlePlacesApiKey: googleKey.trim(),
        defaultNotificationStyle: notificationStyle,
      });
      onCancel();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell
      visible={visible}
      title="הגדרות"
      subtitle="מפתח Gemini, ניתוח, מראה והתראות"
      onClose={onCancel}
      footer={<GradientButton label={isSaving ? "שומר..." : "שמירה"} onPress={handleSave} disabled={isSaving} />}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Theme */}
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>מראה</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => { hapticSelection(); setPreference(option.value); }}
                  style={[styles.themeCard, selected && styles.themeCardSelected]}
                >
                  <Text style={styles.themeIcon}>{option.icon}</Text>
                  <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>

        {/* API key */}
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>מפתח Gemini API אישי</Text>
          <Text style={styles.sectionHelp}>נשמר רק במכשיר שלך ומשמש להקלטה קולית ולניתוח חכם יותר.</Text>

          <View style={styles.keyRow}>
            <Pressable onPress={() => setIsKeyVisible((v) => !v)} style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>{isKeyVisible ? "הסתר" : "הצג"}</Text>
            </Pressable>
            <View style={styles.keyInput}>
              <TextField
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="הדבק כאן מפתח API..."
                secureTextEntry={!isKeyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <Pressable onPress={() => Linking.openURL(GEMINI_KEY_URL)} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>קבלת מפתח חינמי מ-Google AI Studio ↗</Text>
          </Pressable>

          <Field label="שם המודל (מתקדם)" help="השאר ריק לברירת המחדל. אם מקבלים שגיאת 404, אפשר לעדכן כאן שם מודל חדש.">
            <TextField
              value={model}
              onChangeText={setModel}
              placeholder={DEFAULT_MODEL_PLACEHOLDER}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </GlassSurface>

        {/* NLP mode */}
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>אופן ניתוח התזכורות</Text>
          {MODE_OPTIONS.map((option) => (
            <SelectableCard key={option.value} selected={mode === option.value} onPress={() => setMode(option.value)}>
              <Text style={[styles.optionLabel, mode === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              <Text style={styles.optionHelp}>{option.help}</Text>
            </SelectableCard>
          ))}
        </GlassSurface>

        {/* Google Places key — optional, for finding businesses */}
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>חיפוש מקומות ועסקים (אופציונלי)</Text>
          <Text style={styles.sectionHelp}>
            ברירת המחדל (OpenStreetMap) מוצאת בעיקר רחובות וערים. כדי למצוא עסקים ("רמי לוי חדרה", "תחנת דלק סדש") הזן מפתח
            Google עם Places API מופעל — קריאה רגילה בזמן ריצה, לא נשמר בבנייה.
          </Text>
          <View style={styles.keyRow}>
            <Pressable onPress={() => setIsGoogleKeyVisible((v) => !v)} style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>{isGoogleKeyVisible ? "הסתר" : "הצג"}</Text>
            </Pressable>
            <View style={styles.keyInput}>
              <TextField
                value={googleKey}
                onChangeText={setGoogleKey}
                placeholder="מפתח Google (אופציונלי)..."
                secureTextEntry={!isGoogleKeyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </GlassSurface>

        {/* Default notification style */}
        <GlassSurface radius={radii.lg} style={styles.section}>
          <Text style={styles.sectionTitle}>ברירת מחדל להתראה</Text>
          <Text style={styles.sectionHelp}>אפשר לשנות לכל תזכורת בנפרד בעת יצירתה או עריכתה.</Text>
          {NOTIFICATION_STYLE_OPTIONS.map((option) => {
            const meta = getNotificationStyleDisplay(option);
            const selected = notificationStyle === option;
            return (
              <SelectableCard key={option} selected={selected} onPress={() => setNotificationStyle(option)}>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {meta.icon} {meta.label}
                </Text>
                <Text style={styles.optionHelp}>{meta.help}</Text>
              </SelectableCard>
            );
          })}
        </GlassSurface>

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
    sectionHelp: { color: theme.textSecondary, ...typography.caption, textAlign: "right", lineHeight: 18 },

    themeRow: { flexDirection: "row-reverse", gap: spacing.sm },
    themeCard: {
      flex: 1,
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.chip,
      borderWidth: 1,
      borderColor: theme.glassBorder,
    },
    themeCardSelected: { backgroundColor: theme.chipActive, borderColor: theme.accent },
    themeIcon: { fontSize: 20 },
    themeLabel: { color: theme.textSecondary, ...typography.caption },
    themeLabelSelected: { color: theme.accent },

    keyRow: { flexDirection: "row-reverse", gap: spacing.sm, alignItems: "center" },
    keyInput: { flex: 1 },
    toggleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radii.sm, backgroundColor: theme.chip },
    toggleButtonText: { color: theme.textSecondary, ...typography.caption },
    linkButton: { alignSelf: "flex-end" },
    linkButtonText: { color: theme.accent, ...typography.caption, fontWeight: "700" },

    optionLabel: { color: theme.textSecondary, ...typography.label, fontWeight: "800", textAlign: "right" },
    optionLabelSelected: { color: theme.accent },
    optionHelp: { color: theme.textMuted, ...typography.caption, textAlign: "right", lineHeight: 18 },
  });
}
