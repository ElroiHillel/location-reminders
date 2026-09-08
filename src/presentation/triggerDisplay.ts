import { TriggerType } from "../domain/models/TriggerType";

export interface TriggerDisplayMeta {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  backgroundColor: string;
}

const TRIGGER_DISPLAY: Record<TriggerType, TriggerDisplayMeta> = {
  [TriggerType.ENTER]: {
    label: "כניסה לאזור",
    shortLabel: "כניסה",
    icon: "⬇️",
    color: "#07111C",
    backgroundColor: "#7CDBB6",
  },
  [TriggerType.EXIT]: {
    label: "יציאה מאזור",
    shortLabel: "יציאה",
    icon: "⬆️",
    color: "#F4F7FB",
    backgroundColor: "#4A90D9",
  },
  [TriggerType.NEARBY]: {
    label: "בקרבת מקום",
    shortLabel: "קרבה",
    icon: "📍",
    color: "#07111C",
    backgroundColor: "#F5C842",
  },
  [TriggerType.BLUETOOTH_CONNECT]: {
    label: "חיבור לרכב",
    shortLabel: "חיבור רכב",
    icon: "🚗",
    color: "#F4F7FB",
    backgroundColor: "#8B5CF6",
  },
  [TriggerType.BLUETOOTH_DISCONNECT]: {
    label: "ניתוק מרכב",
    shortLabel: "ניתוק רכב",
    icon: "🚪",
    color: "#F4F7FB",
    backgroundColor: "#E06C75",
  },
};

export function getTriggerDisplay(type: TriggerType): TriggerDisplayMeta {
  return TRIGGER_DISPLAY[type];
}

export function isSpatialTrigger(type: TriggerType): boolean {
  return type === TriggerType.ENTER || type === TriggerType.EXIT || type === TriggerType.NEARBY;
}

export function isBluetoothTrigger(type: TriggerType): boolean {
  return type === TriggerType.BLUETOOTH_CONNECT || type === TriggerType.BLUETOOTH_DISCONNECT;
}

/** Natural-language "when" phrasing for a trigger, e.g. "כשתגיע לרמי לוי חדרה". */
export function getConditionText(type: TriggerType, place: string): string {
  const where = place.trim() || "היעד";
  switch (type) {
    case TriggerType.ENTER:
      return `כשתגיע ל${where}`;
    case TriggerType.EXIT:
      return `כשתצא מ${where}`;
    case TriggerType.NEARBY:
      return `כשתהיה ליד ${where}`;
    case TriggerType.BLUETOOTH_CONNECT:
      return `כשתתחבר ל${where}`;
    case TriggerType.BLUETOOTH_DISCONNECT:
      return `כשתתנתק מ${where}`;
    default:
      return where;
  }
}
