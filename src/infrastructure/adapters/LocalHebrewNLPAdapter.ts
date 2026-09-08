import { BluetoothDeviceRepository } from "../../domain/interfaces/BluetoothDeviceRepository";
import { SavedLocationRepository } from "../../domain/interfaces/SavedLocationRepository";
import { NaturalLanguageParserService } from "../../domain/interfaces/NaturalLanguageParserService";
import { ParserInput } from "../../domain/interfaces/types";
import { BluetoothDevice } from "../../domain/models/BluetoothDevice";
import { ParserResult } from "../../domain/models/ParserResult";
import { SavedLocation } from "../../domain/models/SavedLocation";
import { TriggerType } from "../../domain/models/TriggerType";
import { normalizeLocationQueryForGeocoding } from "../../domain/services/normalizeLocationQuery";

type LocationCategory = "HOME" | "WORK" | "PARENTS" | "STORE" | "GYM" | "VEHICLE";

interface TextMatch {
  index: number;
  length: number;
  phrase: string;
}

const PREFIX_LETTERS = new Set(["ל", "ב", "מ", "ה", "כ"]);

const LOCATION_SYNONYMS: Record<LocationCategory, string[]> = {
  HOME: ["בית", "הביתה", "הבית", "לבית", "בבית", "מבית", "לביתי", "בביתי", "מביתי", "דירה", "הדירה", "לדירה", "בדירה"],
  WORK: ["עבודה", "לעבודה", "בעבודה", "מעבודה", "עבודתי", "משרד", "למשרד", "במשרד", "מהמשרד", "משרדי"],
  PARENTS: ["הורים", "להורים", "אצל ההורים", "אמא", "לאמא", "אבא", "לאבא"],
  STORE: ["סופר", "לסופר", "בסופר", "מהסופר", "סופרמרקט", "חנות", "לחנות", "מכולת", "למכולת", "יוחננוף", "רמי לוי", "שופרסל"],
  GYM: ["כושר", "לכושר", "בכושר", "מכון", "למכון", "במכון", "מכון כושר", "סטודיו"],
  VEHICLE: ["רכב", "לרכב", "ברכב", "מהרכב", "אוטו", "לאוטו", "באוטו", "מהאוטו", "דיבורית", "לדיבורית", "בדיבורית", "בלוטוס", "bluetooth"],
};

const CANONICAL_TARGET_BY_CATEGORY: Record<LocationCategory, string> = {
  HOME: "בית",
  WORK: "עבודה",
  PARENTS: "הורים",
  STORE: "סופר",
  GYM: "מכון כושר",
  VEHICLE: "רכב",
};

const ENTER_PATTERNS = [
  "מגיע",
  "מגיעה",
  "נכנס",
  "נכנסת",
  "בא",
  "באה",
  "בהגעה ל",
  "בכניסה ל",
  "כשמגיע",
  "כשאני מגיע",
  "כשאני מגיעה",
];

const EXIT_PATTERNS = [
  "יוצא",
  "יוצאת",
  "עוזב",
  "עוזבת",
  "ביציאה מ",
  "בעזיבה של",
  "כשאני יוצא",
  "כשאני יוצאת",
  "כשיוצא",
  "כשאני עוזב",
];

const NEARBY_PATTERNS = [
  "ליד",
  "בסביבת",
  "בקירבת",
  "בקרבת",
  "עובר ליד",
  "עוברת ליד",
  "עובר ב",
  "עוברת ב",
  "מתקרב ל",
  "מתקרבת ל",
  "כשמתקרב",
];

const VEHICLE_CONNECT_PATTERNS = [
  "מתחבר לרכב",
  "מתחברת לרכב",
  "נכנס לאוטו",
  "נכנסת לאוטו",
  "בחיבור לדיבורית",
  "בחיבור לרכב",
  "בתוך האוטו",
  "בחיבור לבלוטוס",
  "מתחבר",
  "מתחברת",
];

const VEHICLE_DISCONNECT_PATTERNS = ["מתנתק", "מתנתקת", "ניתוק", "בניתוק", "מתנתק מרכב", "מתנתקת מרכב"];

const LEAD_IN_FILLERS = ["תזכיר לי", "תזכירי לי", "תזכיר", "תזכירי", "אני צריך", "אני צריכה", "בבקשה"];

// Infinitive verbs that typically START the "what to do" clause of a reminder.
// Used to split the location clause from the action clause.
const ACTION_VERB_MARKERS = [
  "לקנות", "לקחת", "לקבל", "להביא", "להתקשר", "לצלצל", "לטלפן", "לשלוח", "לשלם", "לבדוק",
  "לעשות", "להוציא", "לזרוק", "לאסוף", "לפגוש", "לדבר", "לרשום", "לכתוב", "להזמין", "למלא",
  "לתדלק", "לחדש", "להחזיר", "לעדכן", "לשאול", "לספר", "לבקר", "לקפוץ", "לאכול", "לשתות",
  "לישון", "לנוח", "להדליק", "לכבות", "לנעול", "לפתוח", "לסגור", "להוריד", "להעלות", "לחתום",
];

export class LocalHebrewNLPAdapter implements NaturalLanguageParserService {
  constructor(
    private readonly savedLocationRepository: SavedLocationRepository,
    private readonly bluetoothDeviceRepository: BluetoothDeviceRepository,
  ) {}

  async parseReminder(input: ParserInput): Promise<ParserResult> {
    const normalizedText = this.normalize(input.text);
    const savedLocations = input.context.savedLocations.length > 0 ? input.context.savedLocations : await this.savedLocationRepository.list();
    const bluetoothDevices = input.context.bluetoothDevices.length > 0 ? input.context.bluetoothDevices : await this.bluetoothDeviceRepository.list();

    const triggerType = this.detectTriggerType(normalizedText);
    const matchedSavedLocation = this.findSavedLocation(normalizedText, savedLocations);
    const matchedBluetoothDevice = this.findBluetoothDevice(normalizedText, bluetoothDevices);
    const category = this.detectLocationCategory(normalizedText);

    // Split the sentence into a location clause and an action clause around the
    // trigger word and the first action-verb, so "כשאני מגיע לרמי לוי בחדרה
    // לקנות חלב" yields location "רמי לוי חדרה" and action "לקנות חלב".
    const segment = this.segmentLocationAndAction(normalizedText);

    const locationTarget = matchedSavedLocation
      ? matchedSavedLocation.label
      : matchedBluetoothDevice
        ? matchedBluetoothDevice.name
        : segment.location
          ? normalizeLocationQueryForGeocoding(segment.location)
          : category
            ? CANONICAL_TARGET_BY_CATEGORY[category]
            : null;

    const action = segment.action || this.stripLeadInPhrases(normalizedText);
    const requiresFallback = this.shouldFallback(normalizedText, triggerType, action, matchedSavedLocation, matchedBluetoothDevice, locationTarget);

    return {
      action,
      locationTarget,
      triggerType,
      confidence: this.resolveConfidence(triggerType, action, matchedSavedLocation, matchedBluetoothDevice, category),
      matchedSavedLocation,
      matchedBluetoothDevice,
      requiresFallback,
    };
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/["'`.,!?;:()[\]{}<>]/g, " ")
      .replace(/\s+/g, " ");
  }

  private tokenize(value: string): string[] {
    return this.normalize(value)
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private stripLeadInPhrases(value: string): string {
    let current = this.normalize(value);
    let changed = true;

    while (changed) {
      changed = false;
      for (const filler of LEAD_IN_FILLERS) {
        const normalizedFiller = this.normalize(filler);
        if (current === normalizedFiller) {
          current = "";
          changed = true;
          break;
        }
        if (current.startsWith(`${normalizedFiller} `)) {
          current = current.slice(normalizedFiller.length).trim();
          changed = true;
        }
      }
    }

    return current;
  }

  private stripUsagePrefixes(word: string): string {
    let candidate = this.normalize(word);
    while (candidate.length > 1 && PREFIX_LETTERS.has(candidate.charAt(0))) {
      candidate = candidate.slice(1);
    }
    return candidate;
  }

  private expandPrefixVariants(word: string): Set<string> {
    const normalized = this.normalize(word);
    const stripped = this.stripUsagePrefixes(normalized);
    return new Set([normalized, stripped]);
  }

  private containsHebrewPhrase(text: string, phrase: string): boolean {
    const normalizedText = this.normalize(text);
    const normalizedPhrase = this.normalize(phrase);

    if (!normalizedPhrase) {
      return false;
    }

    if (normalizedText.includes(normalizedPhrase)) {
      return true;
    }

    const textTokens = this.tokenize(normalizedText);
    const phraseTokens = this.tokenize(normalizedPhrase);
    if (phraseTokens.length === 0 || textTokens.length < phraseTokens.length) {
      return false;
    }

    for (let start = 0; start <= textTokens.length - phraseTokens.length; start += 1) {
      let allTokensMatch = true;
      for (let offset = 0; offset < phraseTokens.length; offset += 1) {
        const textVariants = this.expandPrefixVariants(textTokens[start + offset]);
        const phraseVariants = this.expandPrefixVariants(phraseTokens[offset]);
        const match = [...textVariants].some((variant) => phraseVariants.has(variant));
        if (!match) {
          allTokensMatch = false;
          break;
        }
      }
      if (allTokensMatch) {
        return true;
      }
    }

    return false;
  }

  private detectLocationCategory(text: string): LocationCategory | null {
    const categories = Object.keys(LOCATION_SYNONYMS) as LocationCategory[];
    for (const category of categories) {
      if (LOCATION_SYNONYMS[category].some((phrase) => this.containsHebrewPhrase(text, phrase))) {
        return category;
      }
    }
    return null;
  }

  private findFirstPhraseMatch(text: string, phrases: string[]): TextMatch | null {
    const normalizedText = this.normalize(text);
    const matches = phrases
      .map((phrase) => {
        const normalizedPhrase = this.normalize(phrase);
        return {
          phrase: normalizedPhrase,
          index: normalizedText.indexOf(normalizedPhrase),
          length: normalizedPhrase.length,
        };
      })
      .filter((match) => match.index >= 0)
      .sort((left, right) => left.index - right.index || right.length - left.length);

    if (matches.length === 0) {
      return null;
    }

    return matches[0];
  }

  private detectTriggerType(text: string): TriggerType | null {
    if (this.findFirstPhraseMatch(text, VEHICLE_CONNECT_PATTERNS)) {
      return TriggerType.BLUETOOTH_CONNECT;
    }
    if (this.findFirstPhraseMatch(text, VEHICLE_DISCONNECT_PATTERNS)) {
      return TriggerType.BLUETOOTH_DISCONNECT;
    }
    if (this.findFirstPhraseMatch(text, EXIT_PATTERNS)) {
      return TriggerType.EXIT;
    }
    if (this.findFirstPhraseMatch(text, NEARBY_PATTERNS)) {
      return TriggerType.NEARBY;
    }
    if (this.findFirstPhraseMatch(text, ENTER_PATTERNS)) {
      return TriggerType.ENTER;
    }
    return null;
  }

  private scoreHebrewMatch(textTokens: string[], candidate: string): number {
    if (!candidate) {
      return 0;
    }

    const candidateTokens = this.tokenize(candidate);
    let score = 0;

    for (const candidateToken of candidateTokens) {
      const candidateVariants = this.expandPrefixVariants(candidateToken);
      const tokenMatched = textTokens.some((textToken) => {
        const textVariants = this.expandPrefixVariants(textToken);
        return [...textVariants].some((variant) => candidateVariants.has(variant));
      });
      if (tokenMatched) {
        score += 1;
      }
    }

    return score;
  }

  private findSavedLocation(text: string, savedLocations: SavedLocation[]): SavedLocation | null {
    const textTokens = this.tokenize(text);
    const category = this.detectLocationCategory(text);

    const matches = savedLocations
      .map((location) => {
        const normalizedLabel = this.normalize(location.label);
        const normalizedAddress = this.normalize(location.address);
        const normalizedAliases = (location.aliases ?? []).map((alias) => this.normalize(alias));
        let score = this.scoreHebrewMatch(textTokens, normalizedLabel) + this.scoreHebrewMatch(textTokens, normalizedAddress);

        for (const alias of normalizedAliases) {
          score += this.scoreHebrewMatch(textTokens, alias);
        }

        if (this.containsHebrewPhrase(text, normalizedLabel)) {
          score += 6;
        }

        for (const labelVariant of this.expandPrefixVariants(normalizedLabel)) {
          if (labelVariant && this.containsHebrewPhrase(text, labelVariant)) {
            score += 4;
            break;
          }
        }

        for (const alias of normalizedAliases) {
          if (this.containsHebrewPhrase(text, alias)) {
            score += 4;
            break;
          }
        }

        if (category && LOCATION_SYNONYMS[category].some((synonym) => this.containsHebrewPhrase(normalizedLabel, synonym) || this.containsHebrewPhrase(normalizedAddress, synonym))) {
          score += 3;
        }

        return { location, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return matches[0]?.location ?? null;
  }

  private findBluetoothDevice(text: string, bluetoothDevices: BluetoothDevice[]): BluetoothDevice | null {
    const textTokens = this.tokenize(text);
    const hasVehicleCue = LOCATION_SYNONYMS.VEHICLE.some((phrase) => this.containsHebrewPhrase(text, phrase));

    const matches = bluetoothDevices
      .map((device) => {
        const normalizedName = this.normalize(device.name);
        let score = this.scoreHebrewMatch(textTokens, normalizedName);
        if (device.isVehicle && hasVehicleCue) {
          score += 3;
        }
        return { device, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return matches[0]?.device ?? null;
  }

  private allTriggerPatterns(): string[] {
    return [
      ...VEHICLE_CONNECT_PATTERNS,
      ...VEHICLE_DISCONNECT_PATTERNS,
      ...ENTER_PATTERNS,
      ...EXIT_PATTERNS,
      ...NEARBY_PATTERNS,
    ];
  }

  /**
   * Splits the sentence into a location clause and an action clause around the
   * trigger word and the first action verb. Handles both orders:
   *   "כשאני מגיע ל<מקום> <פעולה>"  and  "<פעולה> כשאני מגיע ל<מקום>".
   */
  private segmentLocationAndAction(text: string): { location: string | null; action: string } {
    const core = this.stripLeadInPhrases(text);
    const triggerMatch = this.findFirstPhraseMatch(core, this.allTriggerPatterns());
    const actionMatch = this.findFirstPhraseMatch(core, ACTION_VERB_MARKERS);

    if (!triggerMatch) {
      return { location: null, action: this.cleanActionPhrase(core) };
    }

    const afterStart = triggerMatch.index + triggerMatch.length;
    const before = core.slice(0, triggerMatch.index);
    const after = core.slice(afterStart);

    let locationRaw: string;
    let actionRaw: string;

    if (actionMatch && actionMatch.index >= afterStart) {
      locationRaw = core.slice(afterStart, actionMatch.index);
      actionRaw = core.slice(actionMatch.index);
    } else if (actionMatch && actionMatch.index < triggerMatch.index) {
      actionRaw = core.slice(actionMatch.index, triggerMatch.index);
      locationRaw = after;
    } else {
      locationRaw = after;
      actionRaw = before;
    }

    return { location: this.cleanLocationPhrase(locationRaw), action: this.cleanActionPhrase(actionRaw) };
  }

  private cleanLocationPhrase(phrase: string): string | null {
    let cleaned = this.normalize(phrase);
    for (const filler of LEAD_IN_FILLERS) {
      cleaned = this.removePhrase(cleaned, filler);
    }
    cleaned = this.stripAttachedPreposition(cleaned.trim());
    const result = cleaned.trim();
    return result.length > 0 ? result : null;
  }

  private cleanActionPhrase(phrase: string): string {
    let cleaned = this.stripLeadInPhrases(phrase);
    // Drop a dangling connector at the start ("כש", "כשאני", "ש", "כאשר", "ברגע ש")
    // or trailing at the end (e.g. "לקנות חלב כשאני" -> "לקנות חלב").
    cleaned = cleaned.replace(/^(כשאני|כשאתה|כשאת|כאשר|ברגע ש?|עד ש?|כש|ש)\s+/, "").trim();
    cleaned = cleaned.replace(/\s+(כשאני|כשאתה|כשאת|כאשר|כש)$/, "").trim();
    return cleaned;
  }

  private stripAttachedPreposition(phrase: string): string {
    const tokens = phrase.split(" ").filter(Boolean);
    if (tokens.length === 0) {
      return phrase;
    }

    const [first, ...rest] = tokens;
    if (first.length > 2 && /^[לבמ]/.test(first)) {
      return [first.slice(1), ...rest].join(" ");
    }

    return tokens.join(" ");
  }

  private removePhrase(text: string, phrase: string): string {
    const normalizedText = this.normalize(text);
    const normalizedPhrase = this.normalize(phrase);
    if (!normalizedPhrase) {
      return normalizedText;
    }
    return this.normalize(normalizedText.replace(normalizedPhrase, " "));
  }

  private shouldFallback(
    text: string,
    triggerType: TriggerType | null,
    action: string,
    matchedSavedLocation: SavedLocation | null,
    matchedBluetoothDevice: BluetoothDevice | null,
    locationTarget: string | null,
  ): boolean {
    const hasCue = Boolean(triggerType);
    const hasAction = action.trim().length > 0;
    const hasEntity = Boolean(matchedSavedLocation || matchedBluetoothDevice || locationTarget || this.detectLocationCategory(text));

    return !(hasCue && hasAction && hasEntity);
  }

  private resolveConfidence(
    triggerType: TriggerType | null,
    action: string,
    matchedSavedLocation: SavedLocation | null,
    matchedBluetoothDevice: BluetoothDevice | null,
    category: LocationCategory | null,
  ): number {
    let confidence = 0.4;

    if (triggerType) {
      confidence += 0.25;
    }
    if (action.trim().length > 0) {
      confidence += 0.15;
    }
    if (matchedSavedLocation || matchedBluetoothDevice) {
      confidence += 0.15;
    }
    if (category) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }
}
