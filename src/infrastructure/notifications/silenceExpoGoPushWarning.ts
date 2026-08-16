import { LogBox } from "react-native";

// expo-notifications logs this once, automatically, the moment it's imported inside Expo Go —
// purely because remote/push registration isn't available there. It's unrelated to the LOCAL
// notifications this app schedules for geofence/Bluetooth triggers (those still work in Expo Go).
// Must be imported before anything else pulls in "expo-notifications", so the ignore pattern is
// registered before the warning fires.
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);
