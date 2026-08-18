import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconAlertTriangle, IconCircleCheck, IconFolderOpen, IconPlus, IconStack2 } from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel } from '@/i18n';

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'abgeschlossen') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  if (status === 'pausiert') return 'warning';
  return 'default'; // geplant
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const { projekte, setProjekte, aufgaben, loading, error, fetchAll } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'aufgaben') {
        const a = crud.enriched.aufgaben.find(e => e.record_id === top.record.record_id);
        const currentKey = lookupKey(a?.fields.aufgabe_status);
        if (currentKey === 'offen') {
          return {
            label: tx('In Bearbeitung setzen'),
            onClick: () => advanceAufgabe(top.record.record_id, 'in_bearbeitung'),
          };
        }
        if (currentKey === 'in_bearbeitung') {
          return {
            label: tx('Als erledigt markieren'),
            onClick: () => advanceAufgabe(top.record.record_id, 'erledigt'),
          };
        }
      }
      if (top.type === 'projekte') {
        const currentKey = lookupKey(top.record.fields.status);
        if (currentKey === 'geplant') {
          return { label: tx('Projekt starten'), onClick: () => advanceProjekt(top.record.record_id, 'in_bearbeitung') };
        }
        if (currentKey === 'in_bearbeitung') {
          return { label: tx('Projekt abschließen'), onClick: () => advanceProjekt(top.record.record_id, 'abgeschlossen') };
        }
      }
      return undefined;
    },
  });

  const enrichedAufgaben = crud.enriched.aufgaben;
  const clock = useClock();

  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Derived values (all hooks above)
  const today = format(clock, 'yyyy-MM-dd');

  const PROJEKT_COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['projekte']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  const projektCards = useMemo<KanbanCard[]>(
    () => projekte.map(p => {
      const status = lookupKey(p.fields.status) ?? PROJEKT_COLUMNS[0]?.key ?? '';
      return {
        id: `projekte:${p.record_id}`,
        column: status,
        title: p.fields.projektname ?? tx('Ohne Name'),
        subtitle: [
          p.fields.vorname, p.fields.nachname,
        ].filter(Boolean).join(' ') || undefined,
        tone: toneForStatus(status),
      };
    }),
    [projekte, PROJEKT_COLUMNS],
  );

  // Überfällige Aufgaben: fälligkeitsdatum < heute und nicht erledigt
  const ueberfaelligeAufgaben = useMemo(
    () => enrichedAufgaben.filter(a =>
      a.fields.faelligkeitsdatum &&
      a.fields.faelligkeitsdatum < today &&
      lookupKey(a.fields.aufgabe_status) !== 'erledigt',
    ),
    [enrichedAufgaben, today],
  );

  // Hochprioritäre offene Aufgaben
  const hochpriorAufgaben = useMemo(
    () => enrichedAufgaben.filter(a =>
      lookupKey(a.fields.prioritaet) === 'hoch' &&
      lookupKey(a.fields.aufgabe_status) !== 'erledigt',
    ).sort((a, b) => (a.fields.faelligkeitsdatum ?? '').localeCompare(b.fields.faelligkeitsdatum ?? '')),
    [enrichedAufgaben],
  );

  // KPI-Werte
  const offeneProjekte = projekte.filter(p => lookupKey(p.fields.status) !== 'abgeschlossen').length;
  const erledigteAufgaben = enrichedAufgaben.filter(a => lookupKey(a.fields.aufgabe_status) === 'erledigt').length;
  const offeneAufgaben = enrichedAufgaben.filter(a => lookupKey(a.fields.aufgabe_status) !== 'erledigt').length;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Plain derivations only below ───

  const projektNames = projekte
    .filter(p => lookupKey(p.fields.status) === 'in_bearbeitung')
    .map(p => p.fields.projektname ?? '');

  const kontextzeile = projektNames.length > 0
    ? tx`${namen(projektNames)} ${projektNames.length === 1 ? tx('läuft gerade') : tx('laufen gerade')}.`
    : offeneProjekte > 0
      ? tx('Noch keine aktiven Projekte — starte eines!')
      : tx('Lege dein erstes Projekt an.');

  async function advanceProjekt(id: string, newStatus: string) {
    const prev = projekte.find(p => p.record_id === id);
    if (!prev) return;
    const optimistic = lookupOption('projekte', 'status', newStatus);
    setProjekte(ps => ps.map(p => p.record_id === id ? { ...p, fields: { ...p.fields, status: optimistic } } : p));
    const undo = () => {
      setProjekte(ps => ps.map(p => p.record_id === id ? { ...p, fields: { ...p.fields, status: prev.fields.status } } : p));
      LivingAppsService.updateProjekteEntry(id, { status: lookupKey(prev.fields.status) }).catch(() => fetchAll());
    };
    undoToast(tx`Projekt auf „${optimistic.label}" gesetzt`, undo);
    try {
      await LivingAppsService.updateProjekteEntry(id, { status: newStatus });
    } catch {
      fetchAll();
    }
  }

  async function advanceAufgabe(id: string, newStatus: string) {
    const label = lookupOption('aufgaben', 'aufgabe_status', newStatus).label;
    undoToast(tx`Aufgabe als „${label}" markiert`);
    try {
      await LivingAppsService.updateAufgabenEntry(id, { aufgabe_status: newStatus });
      fetchAll();
    } catch {
      fetchAll();
    }
  }

  async function moveProjektCard(cardId: string, newColumn: string) {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const prev = projekte.find(p => p.record_id === rid);
    if (!prev) return;
    const optimistic = lookupOption('projekte', 'status', newColumn);
    setProjekte(ps => ps.map(p => p.record_id === rid ? { ...p, fields: { ...p.fields, status: optimistic } } : p));
    const undo = () => {
      setProjekte(ps => ps.map(p => p.record_id === rid ? { ...p, fields: { ...p.fields, status: prev.fields.status } } : p));
      LivingAppsService.updateProjekteEntry(rid, { status: lookupKey(prev.fields.status) }).catch(() => fetchAll());
    };
    undoToast(tx`Projekt nach „${optimistic.label}" verschoben`, undo);
    try {
      await LivingAppsService.updateProjekteEntry(rid, { status: newColumn });
    } catch {
      fetchAll();
    }
  }

  const heroUeberfaellig = ueberfaelligeAufgaben.length > 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
        <p className="text-muted-foreground mt-1">{kontextzeile}</p>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroUeberfaellig && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('In Bearbeitung setzen'),
              onClick: () => advanceAufgabe(ueberfaelligeAufgaben[0].record_id, 'in_bearbeitung'),
            }}
          >
            <b>{namen(ueberfaelligeAufgaben.map(a => a.fields.titel ?? ''))}</b>{' '}
            {ueberfaelligeAufgaben.length === 1
              ? tx('ist überfällig')
              : tx('sind überfällig')}{' '}
            — {tx('fällig war')} {formatDate(ueberfaelligeAufgaben[0].fields.faelligkeitsdatum)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={appLabel('projekte')}
              value={offeneProjekte}
              icon={<IconFolderOpen size={16} className="shrink-0" />}
              tone={offeneProjekte === 0 ? 'success' : 'default'}
              onClick={() => setFilterStatus(filterStatus === '__projekte' ? null : '__projekte')}
              active={filterStatus === '__projekte'}
            />
            <StatStripItem
              title={tx('Offene Aufgaben')}
              value={offeneAufgaben}
              icon={<IconStack2 size={16} className="shrink-0" />}
              tone={ueberfaelligeAufgaben.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Erledigt')}
              value={erledigteAufgaben}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
              tone={erledigteAufgaben > 0 ? 'success' : 'default'}
            />
          </StatStrip>
        }
        primary={
          projekte.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <IconFolderOpen size={48} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-lg">{tx('Noch kein Projekt angelegt')}</p>
                <p className="text-muted-foreground text-sm mt-1">{tx('Starte dein erstes Projekt und behalte den Überblick.')}</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => crud.projekte.openCreate({})}
              >
                <IconPlus size={16} />
                {tx('Erstes Projekt anlegen')}
              </button>
            </div>
          ) : (
            <KanbanWidget
              cards={projektCards}
              columns={PROJEKT_COLUMNS}
              defaultCollapsed={['abgeschlossen', 'pausiert']}
              onCardClick={card => {
                const rid = card.id.split(':')[1];
                const p = projekte.find(x => x.record_id === rid);
                if (p) crud.projekte.openDetail(p);
              }}
              onCardMove={moveProjektCard}
              onAddCard={column => crud.projekte.openCreate({ status: column })}
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Hochprioritäre Aufgaben')}
              items={hochpriorAufgaben.slice(0, 8).map(a => ({
                id: a.record_id,
                title: a.fields.titel ?? tx('Ohne Titel'),
                secondLine: (
                  <>
                    <span className={
                      a.fields.faelligkeitsdatum && a.fields.faelligkeitsdatum < today
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground'
                    }>
                      {a.fields.faelligkeitsdatum && a.fields.faelligkeitsdatum < today
                        ? tx('Überfällig')
                        : lookupKey(a.fields.aufgabe_status) === 'offen'
                          ? tx('Offen')
                          : tx('In Bearbeitung')}
                    </span>
                    {a.fields.faelligkeitsdatum && (
                      <span className="text-muted-foreground"> · {formatDate(a.fields.faelligkeitsdatum)}</span>
                    )}
                    {a.projektName && (
                      <span className="text-muted-foreground"> · {a.projektName}</span>
                    )}
                  </>
                ),
                action: lookupKey(a.fields.aufgabe_status) === 'offen'
                  ? { label: tx('Starten'), onClick: () => advanceAufgabe(a.record_id, 'in_bearbeitung') }
                  : { label: tx('Erledigt'), onClick: () => advanceAufgabe(a.record_id, 'erledigt') },
              }))}
              onItemClick={id => {
                const a = enrichedAufgaben.find(x => x.record_id === id);
                if (a) crud.aufgaben.openDetail(a);
              }}
              empty={{
                text: tx('Keine hochprioritären Aufgaben — alles auf Kurs!'),
                action: { label: tx('Aufgabe anlegen'), onClick: () => crud.aufgaben.openCreate({ prioritaet: 'hoch' }) },
              }}
            />

            <WorkList
              title={tx('Alle offenen Aufgaben')}
              items={enrichedAufgaben
                .filter(a => lookupKey(a.fields.aufgabe_status) !== 'erledigt')
                .sort((a, b) => (a.fields.faelligkeitsdatum ?? '9999').localeCompare(b.fields.faelligkeitsdatum ?? '9999'))
                .slice(0, 6)
                .map(a => ({
                  id: a.record_id,
                  title: a.fields.titel ?? tx('Ohne Titel'),
                  secondLine: (
                    <>
                      <span className="text-muted-foreground">
                        {lookupKey(a.fields.prioritaet) === 'hoch'
                          ? tx('Hoch')
                          : lookupKey(a.fields.prioritaet) === 'mittel'
                            ? tx('Mittel')
                            : tx('Niedrig')}
                      </span>
                      {a.fields.faelligkeitsdatum && (
                        <span className="text-muted-foreground"> · {formatDate(a.fields.faelligkeitsdatum)}</span>
                      )}
                    </>
                  ),
                  action: { label: tx('Öffnen'), onClick: () => crud.aufgaben.openDetail(a) },
                }))}
              onItemClick={id => {
                const a = enrichedAufgaben.find(x => x.record_id === id);
                if (a) crud.aufgaben.openDetail(a);
              }}
              empty={{
                text: tx('Alle Aufgaben erledigt — super gemacht!'),
                action: { label: tx('Neue Aufgabe'), onClick: () => crud.aufgaben.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </>
  );
}
