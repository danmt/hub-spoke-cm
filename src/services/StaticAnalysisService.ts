import { flesch } from "flesch";
import natural from "natural";
import { ParserService } from "./ParserService.js";

const { WordTokenizer, SentimentAnalyzer, PorterStemmer, PorterStemmerEs } =
  natural;

export interface SectionAnalysis {
  header: string;
  wordCount: number;
  readingEase: number;
  sentiment: number;
  topKeywords: string[];
  todoCount: number;
}

export interface GlobalAnalysis {
  totalWordCount: number;
  overallReadingEase: number;
  dominantSentiment: number;
}

export interface FullAuditReport {
  sections: SectionAnalysis[];
  global: GlobalAnalysis;
}

export class StaticAnalysisService {
  private static tokenizer = new WordTokenizer();

  /**
   * Performs deep analysis on a per-section and global basis.
   * Grounded in library-verified metrics for English and Spanish.
   */
  static analyze(content: string, expectedLanguage: string): FullAuditReport {
    const parsed = ParserService.parseMarkdown(content);
    const sectionHeaders = Object.keys(parsed.sections);
    const isSpanish = expectedLanguage.toLowerCase() === "spanish";

    // Select stemmer and vocabulary based on prioritized language
    const stemmer = isSpanish ? PorterStemmerEs : PorterStemmer;
    const langVocab = isSpanish ? "Spanish" : "English";
    const analyzer = new SentimentAnalyzer(langVocab, stemmer, "afinn");

    const sectionResults: SectionAnalysis[] = sectionHeaders.map((header) => {
      const sectionBody = parsed.sections[header];
      const tokens = this.tokenizer.tokenize(sectionBody) || [];

      // Calculate Flesch Reading Ease
      const sentenceCount =
        sectionBody.split(/[.!?]+/).filter((s) => s.trim().length > 0).length ||
        1;
      const syllableCount =
        (sectionBody.match(/[aeiouy]{1,2}/g) || []).length || 1;
      const ease = flesch({
        sentence: sentenceCount,
        word: tokens.length,
        syllable: syllableCount,
      });

      const sentiment = analyzer.getSentiment(tokens);

      const freq: Record<string, number> = {};
      tokens.forEach((t) => {
        const w = t.toLowerCase();
        if (w.length > 4) {
          freq[w] = (freq[w] || 0) + 1;
        }
      });

      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);

      return {
        header,
        wordCount: tokens.length,
        readingEase: Math.round(ease),
        sentiment: parseFloat(sentiment.toFixed(2)),
        topKeywords,
        todoCount: (sectionBody.match(/>\s*\*\*?TODO:?\*?/gi) || []).length,
      };
    });

    const totalWords = sectionResults.reduce((acc, s) => acc + s.wordCount, 0);
    const avgEase =
      sectionResults.reduce((acc, s) => acc + s.readingEase, 0) /
      (sectionResults.length || 1);

    return {
      sections: sectionResults,
      global: {
        totalWordCount: totalWords,
        overallReadingEase: Math.round(avgEase),
        dominantSentiment:
          sectionResults.reduce((acc, s) => acc + s.sentiment, 0) /
          (sectionResults.length || 1),
      },
    };
  }
}
