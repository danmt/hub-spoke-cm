import { BaseWriter } from "./BaseWriter.js";

export class ProseWriter extends BaseWriter {
  id = "prose";
  writingStrategy =
    "Focus on narrative flow, clarity, and transitions. Avoid code blocks unless absolutely necessary to illustrate a point.";
}
