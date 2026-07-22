import type { Aufgaben, Projekte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface AufgabenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Aufgaben;
  /** N:1-Ziel „Projekte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  projekteList: Projekte[];
  /** Klick auf die Projekte-Relation → overlay.push auf dessen Detail. */
  onOpenProjekte?: (record: Projekte) => void;
}

export function AufgabenDetails({
  record,
  projekteList,
  onOpenProjekte,
}: AufgabenDetailsProps) {
  const projektTarget = projekteList.find(r => r.record_id === extractRecordId(record.fields.projekt));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Aufgabentitel" value={record.fields.titel} format="text" />
        <RecordField label="Beschreibung" value={record.fields.aufgabe_beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Priorität" value={record.fields.prioritaet} format="pill" />
        <RecordField label="Fälligkeitsdatum" value={record.fields.faelligkeitsdatum} format="date" />
        <RecordField label="Status" value={record.fields.aufgabe_status} format="pill" />
        <RecordField label="Vorname" value={record.fields.zustaendig_vorname} format="text" />
        <RecordField label="Nachname" value={record.fields.zustaendig_nachname} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Projekt"
          name={projektTarget?.fields.projektname ?? '—'}
          meta={[projektTarget?.fields.vorname, projektTarget?.fields.nachname].filter(Boolean).join(' · ') || undefined}
          onClick={projektTarget && onOpenProjekte ? () => onOpenProjekte!(projektTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUFGABEN} recordId={record.record_id} />
    </>
  );
}
