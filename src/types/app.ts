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
    status: [{ key: "geplant", label: "Geplant" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "pausiert", label: "Pausiert" }],
  },
  'aufgaben': {
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }],
    aufgabe_status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "erledigt", label: "Erledigt" }],
  },
};

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