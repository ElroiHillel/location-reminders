import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, spacing, typography } from "../theme/tokens";
import { hapticSelection } from "../theme/haptics";

export function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {children}
      {help ? <Text style={[styles.help, { color: theme.textMuted }]}>{help}</Text> : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const { theme } = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      textAlign="right"
      {...props}
      style={[
        styles.input,
        { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
        props.style,
      ]}
    />
  );
}

/**
 * A tappable option card that highlights (accent border + tint) when selected.
 * Used for trigger types, notification styles, provider modes, etc.
 */
export function SelectableCard({
  selected,
  onPress,
  children,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={[
        styles.card,
        { backgroundColor: theme.chip, borderColor: theme.glassBorder },
        selected && { backgroundColor: theme.chipActive, borderColor: theme.accent },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Pill({
  selected,
  label,
  icon,
  onPress,
}: {
  selected: boolean;
  label: string;
  icon?: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={[
        styles.pill,
        { backgroundColor: theme.chip, borderColor: theme.glassBorder },
        selected && { backgroundColor: theme.chipActive, borderColor: theme.accent },
      ]}
    >
      {icon ? <Text style={styles.pillIcon}>{icon}</Text> : null}
      <Text style={[styles.pillText, { color: selected ? theme.accent : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...typography.label, textAlign: "right" },
  help: { ...typography.caption, textAlign: "right", lineHeight: 18 },
  input: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    writingDirection: "rtl",
    ...typography.body,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillIcon: { fontSize: 15 },
  pillText: { ...typography.caption, fontWeight: "700" },
});
