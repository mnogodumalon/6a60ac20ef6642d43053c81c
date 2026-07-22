import type { Aufgaben } from './app';

export type EnrichedAufgaben = Aufgaben & {
  projektName: string;
};
