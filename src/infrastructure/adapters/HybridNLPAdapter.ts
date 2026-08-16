import { NaturalLanguageParserService } from "../../domain/interfaces/NaturalLanguageParserService";
import { ParserInput } from "../../domain/interfaces/types";
import { ParserResult } from "../../domain/models/ParserResult";

export class HybridNLPAdapter implements NaturalLanguageParserService {
  constructor(
    private readonly localParser: NaturalLanguageParserService,
    private readonly fallbackParser?: NaturalLanguageParserService,
  ) {}

  async parseReminder(input: ParserInput): Promise<ParserResult> {
    const localResult = await this.localParser.parseReminder(input);
    const shouldFallback = localResult.requiresFallback || localResult.confidence < 0.65 || !localResult.triggerType;

    if (!shouldFallback || !this.fallbackParser) {
      return localResult;
    }

    try {
      const fallbackResult = await this.fallbackParser.parseReminder(input);
      return fallbackResult.confidence >= localResult.confidence ? fallbackResult : localResult;
    } catch {
      return localResult;
    }
  }
}