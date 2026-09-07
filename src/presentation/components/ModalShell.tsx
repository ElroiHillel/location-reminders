import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/ThemeContext";
import { radii, spacing, typography } from "../theme/tokens";
import { AuroraBackground } from "./AuroraBackground";
import { GlassSurface } from "./GlassSurface";
import { hapticLight } from "../theme/haptics";

interface ModalShellProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional element rendered pinned below the scrollable content (e.g. a primary CTA). */
  footer?: React.ReactNode;
}

/**
 * Shared chrome for every modal screen: the Aurora backdrop, a safe area, and a
 * consistent RTL header with a glass close button. Keeps all sheets visually
 * identical and theme-aware.
 */
export function ModalShell({ visible, title, subtitle, onClose, children, footer }: ModalShellProps) {
  const { theme, mode } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <AuroraBackground active={visible} />
        <SafeAreaView style={styles.safe}>
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
          <View style={styles.header}>
            <Pressable onPress={() => { hapticLight(); onClose(); }}>
              <GlassSurface radius={radii.pill} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: theme.text }]}>✕</Text>
              </GlassSurface>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
            </View>
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, direction: "rtl" },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerText: { flex: 1, alignItems: "flex-end" },
  title: { ...typography.title, textAlign: "right" },
  subtitle: { ...typography.caption, marginTop: 2, textAlign: "right" },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  closeIcon: { fontSize: 16, fontWeight: "700" },
  footer: { paddingVertical: spacing.md },
});
