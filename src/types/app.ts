import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Projekte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    projektname?: string;
    beschreibung?: string;
    vorname?: string;
    nachname?: string;
    startdatum?: string; // Format: YYYY-MM-DD oder ISO String
    enddatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
  };
}

export interface Aufgaben {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    projekt?: string; // applookup -> URL zu 'Projekte' Record
    titel?: string;
    aufgabe_beschreibung?: string;
    prioritaet?: LookupValue;
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    aufgabe_status?: LookupValue;
    zustaendig_vorname?: string;
    zustaendig_nachname?: string;
  };
}

export const APP_IDS = {
  PROJEKTE: '6a60ac10150ed11a39476862',
  AUFGABEN: '6a60ac133bfb4b8bb765f87b',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'projekte': {
    status: [{ key: "geplant", get label() { return lookupLabel('projekte', 'status', "geplant") ?? "Geplant"; } }, { key: "in_bearbeitung", get label() { return lookupLabel('projekte', 'status', "in_bearbeitung") ?? "In Bearbeitung"; } }, { key: "abgeschlossen", get label() { return lookupLabel('projekte', 'status', "abgeschlossen") ?? "Abgeschlossen"; } }, { key: "pausiert", get label() { return lookupLabel('projekte', 'status', "pausiert") ?? "Pausiert"; } }],
  },
  'aufgaben': {
    prioritaet: [{ key: "niedrig", get label() { return lookupLabel('aufgaben', 'prioritaet', "niedrig") ?? "Niedrig"; } }, { key: "mittel", get label() { return lookupLabel('aufgaben', 'prioritaet', "mittel") ?? "Mittel"; } }, { key: "hoch", get label() { return lookupLabel('aufgaben', 'prioritaet', "hoch") ?? "Hoch"; } }],
    aufgabe_status: [{ key: "offen", get label() { return lookupLabel('aufgaben', 'aufgabe_status', "offen") ?? "Offen"; } }, { key: "in_bearbeitung", get label() { return lookupLabel('aufgaben', 'aufgabe_status', "in_bearbeitung") ?? "In Bearbeitung"; } }, { key: "erledigt", get label() { return lookupLabel('aufgaben', 'aufgabe_status', "erledigt") ?? "Erledigt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'projekte': {
    'projektname': 'string/text',
    'beschreibung': 'string/textarea',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'startdatum': 'date/date',
    'enddatum': 'date/date',
    'status': 'lookup/select',
  },
  'aufgaben': {
    'projekt': 'applookup/select',
    'titel': 'string/text',
    'aufgabe_beschreibung': 'string/textarea',
    'prioritaet': 'lookup/radio',
    'faelligkeitsdatum': 'date/date',
    'aufgabe_status': 'lookup/select',
    'zustaendig_vorname': 'string/text',
    'zustaendig_nachname': 'string/text',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateProjekte = StripLookup<Projekte['fields']>;
export type CreateAufgaben = StripLookup<Aufgaben['fields']>;