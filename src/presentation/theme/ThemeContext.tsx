import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkPalette, lightPalette, ThemeMode, ThemePalette } from "./tokens";

export type ThemePreference = "system" | "dark" | "light";

const STORAGE_KEY = "location-reminders:theme-preference";

interface ThemeContextValue {
  theme: ThemePalette;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveMode(preference: ThemePreference, systemMode: ThemeMode): ThemeMode {
  return preference === "system" ? systemMode : preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [systemMode, setSystemMode] = useState<ThemeMode>(
    Appearance.getColorScheme() === "light" ? "light" : "dark",
  );

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === "system" || stored === "dark" || stored === "light")) {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemMode(colorScheme === "light" ? "light" : "dark");
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const mode = resolveMode(preference, systemMode);
  const theme = mode === "light" ? lightPalette : darkPalette;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, preference, setPreference }),
    [theme, mode, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
