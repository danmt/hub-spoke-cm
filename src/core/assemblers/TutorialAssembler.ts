import { BaseAssembler } from "./BaseAssembler.js";

export class TutorialAssembler extends BaseAssembler {
  id = "tutorial";
  description =
    "Dynamic step-by-step learning path. Adapts depth to topic complexity.";
  strategyPrompt =
    "Focus on a logical progression from prerequisites to a working final product. If the topic involves multiple stacks, create dedicated implementation sections for each.";
}
