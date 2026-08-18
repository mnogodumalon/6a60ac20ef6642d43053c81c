import type { Projekte, Aufgaben } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ProjekteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Projekte;
  /** 1:N „Aufgaben" (projekt): VOLLE Liste — der Block filtert auf diesen Record. */
  aufgabenList: Aufgaben[];
  /** Zeilen-Klick → overlay.push auf das Aufgaben-Detail (nie der Edit-Dialog). */
  onOpenAufgaben: (record: Aufgaben) => void;
  /** Kontextuelles „+": öffnet den Aufgaben-Dialog mit diesem Record vorgesetzt. */
  onAddAufgaben: () => void;
}

export function ProjekteDetails({
  record,
  aufgabenList,
  onOpenAufgaben,
  onAddAufgaben,
}: ProjekteDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('projekte', 'projektname')} value={record.fields.projektname} format="text" />
        <RecordField label={fieldLabel('projekte', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('projekte', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('projekte', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('projekte', 'startdatum')} value={record.fields.startdatum} format="date" />
        <RecordField label={fieldLabel('projekte', 'enddatum')} value={record.fields.enddatum} format="date" />
        <RecordField label={fieldLabel('projekte', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('aufgaben')}
        items={aufgabenList.filter(r => extractRecordId(r.fields.projekt) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('aufgaben'), meta: r.fields.faelligkeitsdatum })}
        onOpen={onOpenAufgaben}
        onAdd={onAddAufgaben}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.PROJEKTE} recordId={record.record_id} />
    </>
  );
}
