import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

// Location / time / reminder themed glyphs that stream out of the mic.
const PARTICLES: { icon: string; lane: number }[] = [
  { icon: "📍", lane: -46 },
  { icon: "🕐", lane: -18 },
  { icon: "🔔", lane: 12 },
  { icon: "🚗", lane: 44 },
  { icon: "🗺️", lane: -34 },
  { icon: "⏰", lane: 26 },
  { icon: "🏠", lane: -6 },
  { icon: "📌", lane: 36 },
];

const FALL_DISTANCE = 150;
const SLOW_MS = 4200;
const FAST_MS = 1300;

/**
 * A downward "funnel" of reminder-related icons that pour out of the mic —
 * drifting slowly at rest and rushing when active (recording). Pure native-
 * driver transform/opacity, so it stays smooth.
 */
export function IconFunnel({ active }: { active: boolean }) {
  const { theme } = useTheme();
  const values = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const duration = active ? FAST_MS : SLOW_MS;
    const animations = values.map((value, index) => {
      value.setValue(0);
      // Stagger the start across the cycle so the stream is continuous, then loop
      // with no per-iteration gap.
      const startDelay = (index / PARTICLES.length) * duration;
      return Animated.sequence([
        Animated.delay(startDelay),
        Animated.loop(
          Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        ),
      ]);
    });
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [active, values]);

  return (
    <View style={styles.container} pointerEvents="none">
      {PARTICLES.map((particle, index) => {
        const value = values[index];
        const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [0, FALL_DISTANCE] });
        const translateX = value.interpolate({ inputRange: [0, 1], outputRange: [0, particle.lane] });
        const opacity = value.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 0.85, 0.6, 0] });
        const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.05] });
        return (
          <Animated.Text
            key={index}
            style={[styles.particle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
          >
            {particle.icon}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 0, left: 0, right: 0, height: FALL_DISTANCE + 24, alignItems: "center" },
  particle: { position: "absolute", top: 0, fontSize: 20 },
});
