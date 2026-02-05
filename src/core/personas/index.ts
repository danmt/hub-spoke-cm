import { ArgentinianPersona } from "./ArgentinianPersona.js";
import { BasePersona } from "./BasePersona.js";
import { SarcasticSpanishPersona } from "./SarcasticSpanishPersona.js";
import { StandardPersona } from "./StandardPersona.js";

export const PERSONA_REGISTRY: Record<string, BasePersona> = {
  "arg-woman-dev": new ArgentinianPersona(),
  standard: new StandardPersona(),
  "sarcastic-es": new SarcasticSpanishPersona(),
};
