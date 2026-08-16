import { ParserInput } from "./types";
import { ParserResult } from "../models/ParserResult";

export interface NaturalLanguageParserService {
  parseReminder(input: ParserInput): Promise<ParserResult>;
}