import {
  ArchitectInteractionResponse,
  ArchitectResponse,
  AssembleResponse,
  AssemblerInteractionResponse,
  PersonaInteractionResponse,
  PersonaResponse,
  WriterInteractionResponse,
  WriterResponse,
} from "@hub-spoke/core";

/**
 * Maps the interaction type to the data it provides and the response it expects.
 */
export interface InteractionMap {
  architect: {
    data: ArchitectResponse;
    response: ArchitectInteractionResponse;
  };
  assembler: {
    data: AssembleResponse;
    response: AssemblerInteractionResponse;
  };
  persona: {
    data: PersonaResponse;
    response: PersonaInteractionResponse;
  };
  writer: {
    data: WriterResponse;
    response: WriterInteractionResponse;
  };
  retry: {
    data: Error;
    response: boolean;
  };
}

export type InteractionType = keyof InteractionMap;

/**
 * A type-safe version of the 'ask' function.
 */
export type AskHandler = <T extends InteractionType>(
  type: T,
  data: InteractionMap[T]["data"],
) => Promise<InteractionMap[T]["response"]>;
