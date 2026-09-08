import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Reminder } from "../domain/models/Reminder";
import { NotificationStyle } from "../domain/models/NotificationStyle";
import { getConditionText, getTriggerDisplay, isBluetoothTrigger } from "./triggerDisplay";
import { getNotificationStyleDisplay, NOTIFICATION_STYLE_OPTIONS } from "./notificationStyleDisplay";
import { useTheme } from "./theme/ThemeContext";
import { radii, spacing, typography } from "./theme/tokens";
import { GlassSurface } from "./components/GlassSurface";
import { GradientButton } from "./components/GradientButton";
import { hapticSelection } from "./theme/haptics";

interface ReminderConfirmationSheetProps {
  visible: boolean;
  reminder: Reminder | null;
  deviceName?: string | null;
  onChangeStyle: (style: NotificationStyle) => void;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * The post-recording confirmation that "pops up" after a voice reminder is
 * parsed and saved: shows the trigger-aware phrasing ("כשתגיע ל…"), the task,
 * a quick notification-style switch (default pre-selected), and Edit.
 */
export function ReminderConfirmationSheet({
  visible,
  reminder,
  deviceName,
  onChangeStyle,
  onEdit,
  onClose,
}: ReminderConfirmationSheetProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!reminder) {
    return null;
  }

  const trigger = getTriggerDisplay(reminder.triggerType);
  const place = isBluetoothTrigger(reminder.triggerType)
    ? deviceName || "המכשיר"
    : reminder.resolvedLocation?.address || reminder.parsedLocationQuery || "היעד";
  const conditionText = getConditionText(reminder.triggerType, place);

  const cardStyle = {
    opacity: anim,
    transform: [
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <GlassSurface strong radius={radii.xxl} style={styles.card}>
            <View style={[styles.triggerCircle, { backgroundColor: trigger.backgroundColor }]}>
              <Text style={styles.triggerIcon}>{trigger.icon}</Text>
            </View>

            <Text style={styles.conditionText}>{conditionText}</Text>
            <Text style={styles.actionText}>
              נזכיר לך: <Text style={styles.actionStrong}>{reminder.action || reminder.title}</Text>
            </Text>

            <View style={styles.divider} />

            <Text style={styles.styleLabel}>סוג התראה</Text>
            <View style={styles.styleRow}>
              {NOTIFICATION_STYLE_OPTIONS.map((option) => {
                const meta = getNotificationStyleDisplay(option);
                const selected = reminder.notificationStyle === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      hapticSelection();
                      onChangeStyle(option);
                    }}
                    style={[styles.styleButton, selected && styles.styleButtonSelected]}
                  >
                    <Text style={styles.styleIcon}>{meta.icon}</Text>
                    <Text style={[styles.styleText, selected && styles.styleTextSelected]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={onEdit} style={styles.editButton}>
                <Text style={styles.editButtonText}>✏️ ערוך</Text>
              </Pressable>
              <GradientButton label="מעולה" onPress={onClose} style={styles.confirmButton} />
            </View>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    root: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, direction: "rtl" },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.overlay },
    cardWrap: { width: "100%", maxWidth: 420 },
    card: { padding: spacing.xxl, alignItems: "center", gap: spacing.md },
    triggerCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
    triggerIcon: { fontSize: 26 },
    conditionText: { color: theme.text, ...typography.title, textAlign: "center" },
    actionText: { color: theme.textSecondary, ...typography.body, textAlign: "center" },
    actionStrong: { color: theme.accent, fontWeight: "800" },
    divider: { height: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: theme.glassBorder, marginVertical: spacing.sm },
    styleLabel: { color: theme.textMuted, ...typography.caption, textAlign: "center" },
    styleRow: { flexDirection: "row-reverse", gap: spacing.sm, alignSelf: "stretch" },
    styleButton: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.chip,
      borderWidth: 1,
      borderColor: theme.glassBorder,
    },
    styleButtonSelected: { backgroundColor: theme.chipActive, borderColor: theme.accent },
    styleIcon: { fontSize: 20 },
    styleText: { color: theme.textSecondary, ...typography.caption },
    styleTextSelected: { color: theme.accent, fontWeight: "800" },
    actionsRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md, alignSelf: "stretch", marginTop: spacing.sm },
    editButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg, backgroundColor: theme.chip },
    editButtonText: { color: theme.text, ...typography.heading, fontWeight: "700" },
    confirmButton: { flex: 1 },
  });
}
