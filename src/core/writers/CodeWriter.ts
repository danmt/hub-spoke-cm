import { BaseWriter } from "./BaseWriter.js";

export class CodeWriter extends BaseWriter {
  id = "code";
  writingStrategy =
    "Prioritize technical implementation. Provide clean, production-ready code blocks. Ensure all code comments and explanations are in the target language.";
}
