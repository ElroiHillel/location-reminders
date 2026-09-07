import { useRef } from "react";
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { hapticLight } from "../theme/haptics";
import { radii, spacing, typography } from "../theme/tokens";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "alt";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * The signature call-to-action: a gradient-filled pill that dips on press with
 * a light haptic tick. Uses the theme's accent gradient (or the violet→pink
 * "alt" gradient for secondary emphasis).
 */
export function GradientButton({ label, onPress, disabled, variant = "primary", style, textStyle }: GradientButtonProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const colors =
    variant === "alt"
      ? ([theme.accentAltStart, theme.accentAltEnd] as const)
      : ([theme.accentGradientStart, theme.accentGradientEnd] as const);

  function pressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }

  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  function handlePress() {
    hapticLight();
    onPress();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style, disabled && styles.disabled]}>
      <Pressable onPress={handlePress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={styles.inner}>
            <Text style={[styles.label, { color: variant === "alt" ? "#FFFFFF" : theme.onAccent }, textStyle]}>
              {label}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: radii.lg,
  },
  inner: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.heading,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
});
