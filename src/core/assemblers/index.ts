import { Assembler } from "./BaseAssembler.js";
import { DeepDiveAssembler } from "./DeepDiveAssembler.js";
import { TutorialAssembler } from "./TutorialAssembler.js";

export const ASSEMBLER_REGISTRY: Record<string, Assembler> = {
  tutorial: new TutorialAssembler(),
  "deep-dive": new DeepDiveAssembler(),
};
