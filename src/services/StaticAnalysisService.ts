// src/services/StaticAnalysisService.ts
import { flesch } from "flesch";
import natural from "natural";
import { LoggerService } from "./LoggerService.js";
import { ParserService } from "./ParserService.js";

const { WordTokenizer, SentimentAnalyzer, PorterStemmer, PorterStemmerEs } =
  natural;

export interface SectionAnalysis {
  sectionId: string;
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
   * Logs calculated metrics for trace observability.
   */
  static analyze(content: string, expectedLanguage: string): FullAuditReport {
    const parsed = ParserService.parseMarkdown(content);
    const sectionHeaders = Object.keys(parsed.sections);
    const isSpanish = expectedLanguage.toLowerCase() === "spanish";

    // Select stemmer and vocabulary based on prioritized language
    const stemmer = isSpanish ? PorterStemmerEs : PorterStemmer;
    const langVocab = isSpanish ? "Spanish" : "English";
    const analyzer = new SentimentAnalyzer(langVocab, stemmer, "afinn");

    const sectionResults: SectionAnalysis[] = Object.keys(parsed.sections).map(
      (sectionId) => {
        const sectionBody = parsed.sections[sectionId];
        const tokens = this.tokenizer.tokenize(sectionBody) || [];

        // Calculate Flesch Reading Ease
        const sentenceCount =
          sectionBody.split(/[.!?]+/).filter((s) => s.trim().length > 0)
            .length || 1;
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

        const analysis = {
          sectionId,
          wordCount: tokens.length,
          readingEase: Math.round(ease),
          sentiment: parseFloat(sentiment.toFixed(2)),
          topKeywords,
          todoCount: (sectionBody.match(/>\s*\*\*?TODO:?\*?/gi) || []).length,
        };

        // Trace: Log granular section metrics
        LoggerService.debug(`StaticAnalysis: Section "${sectionId}" analyzed`, {
          wordCount: analysis.wordCount,
          readingEase: analysis.readingEase,
          todoCount: analysis.todoCount,
        });

        return analysis;
      },
    );

    const totalWords = sectionResults.reduce((acc, s) => acc + s.wordCount, 0);
    const avgEase =
      sectionResults.reduce((acc, s) => acc + s.readingEase, 0) /
      (sectionResults.length || 1);

    const report = {
      sections: sectionResults,
      global: {
        totalWordCount: totalWords,
        overallReadingEase: Math.round(avgEase),
        dominantSentiment:
          sectionResults.reduce((acc, s) => acc + s.sentiment, 0) /
          (sectionResults.length || 1),
      },
    };

    // Trace: Log global document health
    LoggerService.debug("StaticAnalysis: Global report generated", {
      totalWords: report.global.totalWordCount,
      avgReadingEase: report.global.overallReadingEase,
    });

    return report;
  }
}
