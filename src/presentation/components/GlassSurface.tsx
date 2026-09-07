import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../theme/ThemeContext";
import { radii } from "../theme/tokens";

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use the more opaque glass fill (for foreground panels that need contrast). */
  strong?: boolean;
  radius?: number;
}

/**
 * A frosted-glass surface. On iOS it uses a real BlurView; on Android (where
 * expo-blur's blur is experimental) it renders a well-tuned translucent panel
 * that reads as glass over the Aurora backdrop — no experimental blur, so it
 * stays fast and predictable.
 */
export function GlassSurface({ children, style, strong = false, radius = radii.lg }: GlassSurfaceProps) {
  const { theme, mode } = useTheme();
  const fill = strong ? theme.glassStrong : theme.glass;

  const shell: StyleProp<ViewStyle> = [
    styles.base,
    { borderRadius: radius, borderColor: theme.glassBorder },
    style,
  ];

  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={strong ? 55 : 34} tint={mode === "light" ? "light" : "dark"} style={shell}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill, borderRadius: radius }]} />
        <View
          style={[
            styles.highlight,
            { borderRadius: radius, borderColor: theme.glassHighlight },
          ]}
          pointerEvents="none"
        />
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[shell, { backgroundColor: fill }]}>
      <View
        style={[styles.highlight, { borderRadius: radius, borderColor: theme.glassHighlight }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    opacity: 0.6,
  },
});
