/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'projekte'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.projekte.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.projekte.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.projekte.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.projekte              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   projekte: projektname, beschreibung, vorname, nachname, startdatum, enddatum, status  ·  ← aufgaben (list + contextual +)
 *   aufgaben: projekt, titel, aufgabe_beschreibung, prioritaet, faelligkeitsdatum, aufgabe_status, zustaendig_vorname, zustaendig_nachname  ·  → projekte
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Projekte, Aufgaben } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichAufgaben } from '@/lib/enrich';
import type { EnrichedAufgaben } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ProjekteDialog, type ProjekteDialogDefaults } from '@/components/dialogs/ProjekteDialog';
import { ProjekteDetails } from '@/components/details/ProjekteDetails';
import { AufgabenDialog, type AufgabenDialogDefaults } from '@/components/dialogs/AufgabenDialog';
import { AufgabenDetails } from '@/components/details/AufgabenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'projekte'; record: Projekte }
  | { type: 'aufgaben'; record: EnrichedAufgaben };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  projekte: EntityCrudApi<Projekte, ProjekteDialogDefaults>;
  aufgaben: EntityCrudApi<Aufgaben, AufgabenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { projekte: Projekte[]; aufgaben: EnrichedAufgaben[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [projekteDialog, setProjekteDialog] = useState<{ defaults?: ProjekteDialogDefaults; editing?: Projekte } | null>(null);
  const [aufgabenDialog, setAufgabenDialog] = useState<{ defaults?: AufgabenDialogDefaults; editing?: Aufgaben } | null>(null);
  const enrichedAufgaben = useMemo(() => enrichAufgaben(data.aufgaben, { projekteMap: data.projekteMap }), [data.aufgaben, data.projekteMap]);

  function detailProjekte(record: Projekte, push = false) {
    const item: OverlayItem = { type: 'projekte', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitProjekte(fields: Projekte['fields']) {
    const editing = projekteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setProjekte(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateProjekteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('projekte')} — ${t('crud_updated')}`, async () => {
        data.setProjekte(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateProjekteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createProjekteEntry(fields);
      undoToast(`${appLabel('projekte')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAufgaben(record: Aufgaben, push = false) {
    const rec = enrichedAufgaben.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'aufgaben', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAufgaben(fields: Aufgaben['fields']) {
    const editing = aufgabenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAufgaben(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAufgabenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('aufgaben')} — ${t('crud_updated')}`, async () => {
        data.setAufgaben(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAufgabenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAufgabenEntry(fields);
      undoToast(`${appLabel('aufgaben')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <ProjekteDialog
        open={projekteDialog !== null}
        onClose={() => setProjekteDialog(null)}
        onSubmit={submitProjekte}
        defaultValues={projekteDialog?.defaults}
        recordId={projekteDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Projekte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Projekte']}
      />
      <AufgabenDialog
        open={aufgabenDialog !== null}
        onClose={() => setAufgabenDialog(null)}
        onSubmit={submitAufgaben}
        defaultValues={aufgabenDialog?.defaults}
        recordId={aufgabenDialog?.editing?.record_id}
        projekteList={data.projekte}
        enablePhotoScan={AI_PHOTO_SCAN['Aufgaben']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Aufgaben']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'projekte') {
            return (
              <>
                <RecordHeader title={top.record.fields.projektname ?? appLabel('projekte')} subtitle={top.record.fields.startdatum ? formatDate(top.record.fields.startdatum) : undefined} />
                <ProjekteDetails
                  record={top.record}
                  aufgabenList={data.aufgaben}
                  onOpenAufgaben={(r) => detailAufgaben(r, true)}
                  onAddAufgaben={() => setAufgabenDialog({ defaults: { projekt: createRecordUrl(APP_IDS.PROJEKTE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'aufgaben') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('aufgaben')} subtitle={top.record.fields.faelligkeitsdatum ? formatDate(top.record.fields.faelligkeitsdatum) : undefined} />
                <AufgabenDetails
                  record={top.record}
                  projekteList={data.projekte}
                  onOpenProjekte={(r) => detailProjekte(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'projekte') setProjekteDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'aufgaben') setAufgabenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    projekte: {
      openCreate: (defaults?: ProjekteDialogDefaults) => setProjekteDialog({ defaults }),
      openEdit: (record: Projekte) => setProjekteDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Projekte) => detailProjekte(record, false),
    },
    aufgaben: {
      openCreate: (defaults?: AufgabenDialogDefaults) => setAufgabenDialog({ defaults }),
      openEdit: (record: Aufgaben) => setAufgabenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Aufgaben) => detailAufgaben(record, false),
    },
    enriched: { projekte: data.projekte, aufgaben: enrichedAufgaben },
  };
}
