import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { width } = Dimensions.get("window");
const BLOB = width * 1.15;

/**
 * The living Aurora backdrop: three soft colored blobs that drift and breathe
 * slowly behind the frosted-glass content. Pure transform/opacity animation on
 * the native driver, so it stays smooth and cheap.
 */
export function AuroraBackground({ active = true }: { active?: boolean }) {
  const { theme } = useTheme();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 18000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, active]);

  const driftUp = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const driftDown = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 46] });
  const swayRight = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 34] });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.blob,
          { top: -BLOB * 0.35, left: -BLOB * 0.28, transform: [{ translateY: driftUp }, { translateX: swayRight }] },
        ]}
      >
        <LinearGradient
          colors={[theme.auroraOne, "transparent"]}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.blob,
          { top: -BLOB * 0.18, right: -BLOB * 0.34, transform: [{ translateY: driftDown }] },
        ]}
      >
        <LinearGradient
          colors={[theme.auroraTwo, "transparent"]}
          start={{ x: 0.7, y: 0.1 }}
          end={{ x: 0.1, y: 0.9 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.blob,
          { bottom: -BLOB * 0.4, left: -BLOB * 0.12, transform: [{ translateY: driftUp }, { translateX: swayRight }] },
        ]}
      >
        <LinearGradient
          colors={[theme.auroraThree, "transparent"]}
          start={{ x: 0.2, y: 0.8 }}
          end={{ x: 0.9, y: 0.1 }}
          style={styles.fill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: BLOB,
    height: BLOB,
    borderRadius: BLOB / 2,
    overflow: "hidden",
    opacity: 0.9,
  },
  fill: {
    flex: 1,
  },
});
