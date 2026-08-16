import { GeocodingService } from "../../domain/interfaces/GeocodingService";
import { NaturalLanguageParserService } from "../../domain/interfaces/NaturalLanguageParserService";
import { SpeechToTextService } from "../../domain/interfaces/SpeechToTextService";

export interface INLPParsingService extends NaturalLanguageParserService {}

export interface IGeocodingService extends GeocodingService {}

export interface ISpeechToTextService extends SpeechToTextService {}