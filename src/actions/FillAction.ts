// src/actions/FillAction.ts
import { Persona, PersonaInteractionHandler } from "../agents/Persona.js";
import { Writer, WriterInteractionHandler } from "../agents/Writer.js";
import { LoggerService } from "../services/LoggerService.js";
import { ParserService } from "../services/ParserService.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export interface FillActionExecuteParams {
  content: string;
  sectionIdsToFill: string[];
}

export class FillAction {
  private _onWrite?: WriterInteractionHandler;
  private _onRephrase?: PersonaInteractionHandler;
  private _onRetry?: (err: Error) => Promise<boolean>;
  private _onStart?: (data: string) => void;
  private _onWriting?: (data: { id: string; writerId: string }) => void;
  private _onRephrasing?: (data: { id: string; personaId: string }) => void;

  constructor(
    private persona: Persona,
    private writers: Writer[],
  ) {}

  onStart(cb: typeof this._onStart) {
    this._onStart = cb;
    return this;
  }

  onWriting(cb: typeof this._onWriting) {
    this._onWriting = cb;
    return this;
  }

  onWrite(handler: WriterInteractionHandler) {
    this._onWrite = handler;
    return this;
  }

  onRephrasing(cb: typeof this._onRephrasing) {
    this._onRephrasing = cb;
    return this;
  }

  onRephrase(handler: PersonaInteractionHandler) {
    this._onRephrase = handler;
    return this;
  }

  onRetry(handler: (err: Error) => Promise<boolean>) {
    this._onRetry = handler;
    return this;
  }

  async execute({ content, sectionIdsToFill }: FillActionExecuteParams) {
    await LoggerService.info(`FillAction: Starting execution`, {
      sectionIdsToFill,
    });

    const parsed = ParserService.parseMarkdown(content);
    const sectionIds = Object.keys(parsed.sections);
    const blueprint = parsed.frontmatter.blueprint || {};

    const updatedSections = { ...parsed.sections };

    for (let i = 0; i < sectionIds.length; i++) {
      const sectionId = sectionIds[i];
      if (!sectionIdsToFill.includes(sectionId)) continue;

      const body = updatedSections[sectionId];
      const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";
      const writerId = blueprint[sectionId].writerId;
      const writer = this.writers.find((w) => w.id === writerId);

      if (!writer) throw new Error(`Writer "${writerId}" not found.`);

      this._onStart?.(sectionId);

      // 1. Neutral Writing Phase
      const neutral = await writer.write({
        intent,
        topic: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal,
        audience: parsed.frontmatter.audience,
        bridge: blueprint[sectionId].bridge,
        isFirst: i === 0,
        isLast: i === sectionIds.length - 1,
        interact: this._onWrite,
        onRetry: this._onRetry,
        onThinking: () => this._onWriting?.({ id: sectionId, writerId }),
      });

      // 2. Persona Rephrasing Phase
      const rephrased = await this.persona.rephrase({
        header: neutral.header,
        content: neutral.content,
        interact: this._onRephrase,
        onRetry: this._onRetry,
        onThinking: () =>
          this._onRephrasing?.({ id: sectionId, personaId: this.persona.id }),
      });

      updatedSections[sectionId] =
        `${rephrased.header}\n\n${rephrased.content}`;
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      parsed.frontmatter,
      updatedSections,
    );

    await LoggerService.info(`FillAction: Execution finished`);

    return finalMarkdown;
  }
}
