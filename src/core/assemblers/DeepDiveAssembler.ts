import { BaseAssembler } from "./BaseAssembler.js";

export class DeepDiveAssembler extends BaseAssembler {
  id = "deep-dive";
  description = "Advanced architectural and performance analysis.";
  strategyPrompt =
    "Focus on internals, trade-offs, and edge cases. Headers should reflect senior-level technical scrutiny.";
}
