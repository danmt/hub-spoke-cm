import { BaseWriter } from "./BaseWriter.js";
import { CodeWriter } from "./CodeWriter.js";
import { ProseWriter } from "./ProseWriter.js";

export const WRITER_REGISTRY: Record<string, BaseWriter> = {
  prose: new ProseWriter(),
  code: new CodeWriter(),
};
