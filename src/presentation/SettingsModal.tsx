import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SettingsModalProps } from "./types";
import { UserSettings } from "../domain/models/UserSettings";
import { getNotificationStyleDisplay, NOTIFICATION_STYLE_OPTIONS } from "./notificationStyleDisplay";

const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";
const DEFAULT_MODEL_PLACEHOLDER = "gemini-flash-latest";

const MODE_OPTIONS: { value: UserSettings["nlpProviderPreference"]; label: string; help: string }[] = [
  { value: "hybrid", label: "היברידי (מומלץ)", help: "מנסה קודם ניתוח מקומי חינמי, ופונה ל-Gemini רק כשצריך." },
  { value: "local", label: "מקומי בלבד", help: "לא שולח כלום לאינטרנט, אך פחות מדויק עם ניסוחים חופשיים." },
  { value: "gemini", label: "Gemini בלבד", help: "הכי מדויק, אבל דורש מפתח API ושולח את הטקסט ל-Google." },
];

export function SettingsModal({ visible, initialSettings, onCancel, onSave }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(initialSettings.geminiApiKey ?? "");
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [mode, setMode] = useState<UserSettings["nlpProviderPreference"]>(initialSettings.nlpProviderPreference);
  const [model, setModel] = useState(initialSettings.geminiModel ?? "");
  const [notificationStyle, setNotificationStyle] = useState(initialSettings.defaultNotificationStyle);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setApiKey(initialSettings.geminiApiKey ?? "");
      setMode(initialSettings.nlpProviderPreference);
      setModel(initialSettings.geminiModel ?? "");
      setNotificationStyle(initialSettings.defaultNotificationStyle);
      setIsKeyVisible(false);
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
        defaultNotificationStyle: notificationStyle,
      });
      onCancel();
    } finally {
      setIsSaving(false);
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
            <Text style={styles.title}>הגדרות</Text>
            <Text style={styles.subtitle}>מפתח Gemini אישי ואופן ניתוח התזכורות.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מפתח Gemini API אישי</Text>
            <Text style={styles.sectionHelp}>
              המפתח נשמר רק במכשיר שלך ומשמש להקלטה קולית ולניתוח חכם יותר של תזכורות.
            </Text>

            <View style={styles.keyRow}>
              <Pressable onPress={() => setIsKeyVisible((current) => !current)} style={styles.toggleButton}>
                <Text style={styles.toggleButtonText}>{isKeyVisible ? "הסתר" : "הצג"}</Text>
              </Pressable>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="הדבק כאן מפתח API..."
                placeholderTextColor="#8B96A8"
                style={styles.input}
                secureTextEntry={!isKeyVisible}
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="right"
              />
            </View>

            <Pressable onPress={() => Linking.openURL(GEMINI_KEY_URL)} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>קבלת מפתח חינמי מ-Google AI Studio ↗</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>שם המודל (מתקדם)</Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder={DEFAULT_MODEL_PLACEHOLDER}
              placeholderTextColor="#8B96A8"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
            <Text style={styles.sectionHelp}>
              השאירו ריק כדי להשתמש בברירת המחדל. אם Google מוציאה מודל משימוש ומקבלים שגיאת 404, אפשר לעדכן כאן שם
              מודל חדש בלי לחכות לעדכון קוד.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>אופן ניתוח התזכורות</Text>
            {MODE_OPTIONS.map((option) => {
              const isSelected = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setMode(option.value)}
                  style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                >
                  <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>{option.label}</Text>
                  <Text style={styles.modeHelp}>{option.help}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ברירת מחדל להתראה</Text>
            <Text style={styles.sectionHelp}>אפשר לשנות לכל תזכורת בנפרד בעת יצירתה או עריכתה.</Text>
            {NOTIFICATION_STYLE_OPTIONS.map((option) => {
              const meta = getNotificationStyleDisplay(option);
              const isSelected = notificationStyle === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setNotificationStyle(option)}
                  style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                >
                  <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                    {meta.icon} {meta.label}
                  </Text>
                  <Text style={styles.modeHelp}>{meta.help}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={handleSave} disabled={isSaving} style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}>
            <Text style={styles.saveButtonText}>{isSaving ? "שומר..." : "שמירה"}</Text>
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
  sectionHelp: {
    color: "#9AA8BA",
    textAlign: "right",
    lineHeight: 20,
    fontSize: 13,
  },
  fieldLabel: {
    color: "#DDE7F2",
    fontWeight: "700",
    textAlign: "right",
  },
  keyRow: {
    flexDirection: "row-reverse",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#122033",
    borderWidth: 1,
    borderColor: "#20324A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F7FB",
    writingDirection: "rtl",
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#22344A",
  },
  toggleButtonText: {
    color: "#DDE7F2",
    fontWeight: "700",
    fontSize: 12,
  },
  linkButton: {
    alignSelf: "flex-end",
  },
  linkButtonText: {
    color: "#7CDBB6",
    fontWeight: "700",
    fontSize: 13,
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#20324A",
    backgroundColor: "#122033",
    padding: 12,
    gap: 4,
  },
  modeCardSelected: {
    borderColor: "#7CDBB6",
    backgroundColor: "#173245",
  },
  modeLabel: {
    color: "#DDE7F2",
    fontWeight: "800",
    textAlign: "right",
  },
  modeLabelSelected: {
    color: "#7CDBB6",
  },
  modeHelp: {
    color: "#9AA8BA",
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: "#7CDBB6",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#07111C",
    fontWeight: "800",
    fontSize: 16,
  },
});
