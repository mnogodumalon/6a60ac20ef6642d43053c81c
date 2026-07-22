import { useMemo, useState } from 'react';
import { format, parseISO, isToday, isBefore } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAufgaben } from '@/lib/enrich';
import type { Projekte, Aufgaben } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { HeroBanner } from '@/components/HeroBanner';
import {
  KanbanWidget,
  KanbanSkeleton,
  KanbanError,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { AufgabenDetails } from '@/components/details/AufgabenDetails';
import { ProjekteDetails } from '@/components/details/ProjekteDetails';
import { AufgabenDialog } from '@/components/dialogs/AufgabenDialog';
import { ProjekteDialog } from '@/components/dialogs/ProjekteDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconFolderOpen,
  IconClipboardList,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a60ac20ef6642d43053c81c';
const REPAIR_ENDPOINT = '/claude/build/repair';

// ── Kanban columns from schema ───────────────────────────────────────────────
const AUFGABEN_COLUMNS: KanbanColumn[] = (
  LOOKUP_OPTIONS['aufgaben']?.['aufgabe_status'] ?? []
).map(o => ({ key: o.key, label: o.label }));

function toneForAufgabenStatus(status: string | undefined): KanbanTone {
  if (status === 'erledigt') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  return 'warning'; // offen → needs attention
}

// ── Priority tone ─────────────────────────────────────────────────────────
function toneForPriority(prio: string | undefined): KanbanTone {
  if (prio === 'hoch') return 'destructive';
  if (prio === 'mittel') return 'warning';
  return 'default';
}

type OverlayItem =
  | { type: 'aufgabe'; record: Aufgaben }
  | { type: 'projekt'; record: Projekte };

export default function DashboardOverview() {
  const {
    projekte, setProjekte,
    aufgaben, setAufgaben,
    projekteMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');

  const enrichedAufgaben = enrichAufgaben(aufgaben, { projekteMap });

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [aufgabenDialogOpen, setAufgabenDialogOpen] = useState(false);
  const [aufgabenDefaults, setAufgabenDefaults] = useState<(Omit<Aufgaben['fields'], 'prioritaet' | 'aufgabe_status'> & { prioritaet?: string; aufgabe_status?: string }) | undefined>(undefined);
  const [editAufgabe, setEditAufgabe] = useState<Aufgaben | undefined>(undefined);

  const [projekteDialogOpen, setProjekteDialogOpen] = useState(false);
  const [editProjekt, setEditProjekt] = useState<Projekte | undefined>(undefined);

  // ── Overlay stack ─────────────────────────────────────────────────────────
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ── Computed data ─────────────────────────────────────────────────────────
  const faelligeAufgaben = useMemo(
    () =>
      aufgaben.filter(a => {
        const st = lookupKey(a.fields.aufgabe_status);
        if (st === 'erledigt') return false;
        const fd = a.fields.faelligkeitsdatum;
        if (!fd) return false;
        return isToday(parseISO(fd)) || isBefore(parseISO(fd), clock);
      }).sort((a, b) => (a.fields.faelligkeitsdatum ?? '').localeCompare(b.fields.faelligkeitsdatum ?? '')),
    [aufgaben, clock],
  );

  const offeneAufgaben = useMemo(
    () => aufgaben.filter(a => lookupKey(a.fields.aufgabe_status) !== 'erledigt'),
    [aufgaben],
  );

  const aktive = useMemo(
    () => projekte.filter(p => lookupKey(p.fields.status) === 'in_bearbeitung'),
    [projekte],
  );

  const abgeschlossen = useMemo(
    () => projekte.filter(p => lookupKey(p.fields.status) === 'abgeschlossen').length,
    [projekte],
  );

  // ── Context line ──────────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (projekte.length === 0) return 'Noch keine Projekte — leg jetzt los.';
    const aktivNames = aktive.map(p => p.fields.projektname ?? '').filter(Boolean);
    const aktivStr = aktivNames.length > 0 ? `Aktiv: ${namen(aktivNames, 2)}` : 'Keine aktiven Projekte';
    const faelligStr = faelligeAufgaben.length > 0
      ? ` · ${faelligeAufgaben.length} Aufgabe${faelligeAufgaben.length !== 1 ? 'n' : ''} fällig`
      : ' · Alle Aufgaben im Zeitplan';
    return aktivStr + faelligStr;
  }, [projekte, aktive, faelligeAufgaben]);

  // ── Hooks must all be BEFORE early returns ────────────────────────────────

  // ── Kanban cards ──────────────────────────────────────────────────────────
  const cards = useMemo<KanbanCard[]>(
    () =>
      enrichedAufgaben.map(a => {
        const status = lookupKey(a.fields.aufgabe_status) ?? AUFGABEN_COLUMNS[0]?.key ?? '';
        const prio = lookupKey(a.fields.prioritaet);
        const tone: KanbanTone =
          status === 'erledigt' ? 'success' :
          prio === 'hoch' ? toneForPriority(prio) :
          toneForAufgabenStatus(status);
        return {
          id: `aufgabe:${a.record_id}`,
          column: status,
          title: a.fields.titel ?? 'Ohne Titel',
          subtitle: a.projektName
            ? `${a.projektName}${a.fields.faelligkeitsdatum ? ' · fällig ' + formatDate(a.fields.faelligkeitsdatum) : ''}`
            : (a.fields.faelligkeitsdatum ? 'fällig ' + formatDate(a.fields.faelligkeitsdatum) : undefined),
          tone,
        };
      }),
    [enrichedAufgaben],
  );

  // ── Status advance helper ─────────────────────────────────────────────────
  const advanceAufgabe = async (a: Aufgaben) => {
    const st = lookupKey(a.fields.aufgabe_status);
    const next = st === 'offen' ? 'in_bearbeitung' : st === 'in_bearbeitung' ? 'erledigt' : null;
    if (!next) return;
    const nextLabel = next === 'in_bearbeitung' ? 'In Bearbeitung' : 'Erledigt';
    const prev = a.fields.aufgabe_status;
    setAufgaben(cur =>
      cur.map(x =>
        x.record_id === a.record_id
          ? { ...x, fields: { ...x.fields, aufgabe_status: { key: next, label: nextLabel } } }
          : x,
      ),
    );
    undoToast(
      `„${a.fields.titel ?? 'Aufgabe'}" → ${nextLabel}`,
      async () => {
        setAufgaben(cur =>
          cur.map(x => x.record_id === a.record_id ? { ...x, fields: { ...x.fields, aufgabe_status: prev } } : x),
        );
        try { await LivingAppsService.updateAufgabenEntry(a.record_id, { aufgabe_status: typeof prev === 'object' ? prev.key : prev }); } catch { await fetchAll(); }
      },
    );
    try {
      await LivingAppsService.updateAufgabenEntry(a.record_id, { aufgabe_status: next });
    } catch {
      await fetchAll();
    }
  };

  // ── Kanban move ──────────────────────────────────────────────────────────
  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const target = aufgaben.find(a => a.record_id === rid);
    if (!target) return;
    const labelMap: Record<string, string> = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt' };
    const prev = target.fields.aufgabe_status;
    setAufgaben(cur =>
      cur.map(a =>
        a.record_id === rid
          ? { ...a, fields: { ...a.fields, aufgabe_status: { key: newColumn, label: labelMap[newColumn] ?? newColumn } } }
          : a,
      ),
    );
    undoToast(
      `„${target.fields.titel ?? 'Aufgabe'}" → ${labelMap[newColumn] ?? newColumn}`,
      async () => {
        setAufgaben(cur =>
          cur.map(a => a.record_id === rid ? { ...a, fields: { ...a.fields, aufgabe_status: prev } } : a),
        );
        try { await LivingAppsService.updateAufgabenEntry(rid, { aufgabe_status: typeof prev === 'object' ? prev?.key : prev }); } catch { await fetchAll(); }
      },
    );
    try {
      await LivingAppsService.updateAufgabenEntry(rid, { aufgabe_status: newColumn });
    } catch {
      await fetchAll();
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Overlay record helpers ─────────────────────────────────────────────────
  const topAufgabe = overlay.top?.type === 'aufgabe' ? overlay.top.record : null;
  const topProjekt = overlay.top?.type === 'projekt' ? overlay.top.record : null;

  // hero: überfällig (nicht nur heute, tatsächlich vergangen)
  const ueberfaellig = faelligeAufgaben.filter(a => {
    const fd = a.fields.faelligkeitsdatum;
    return fd && isBefore(parseISO(fd), new Date(today)) && !isToday(parseISO(fd));
  });
  const heroAufgabe = ueberfaellig[0];

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{contextLine}</p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditProjekt(undefined); setProjekteDialogOpen(true); }}
            >
              <IconFolderOpen size={14} className="mr-1.5 shrink-0" />
              Projekt anlegen
            </Button>
            <Button
              size="sm"
              onClick={() => { setAufgabenDefaults(undefined); setEditAufgabe(undefined); setAufgabenDialogOpen(true); }}
            >
              <IconPlus size={14} className="mr-1.5 shrink-0" />
              Neue Aufgabe
            </Button>
          </div>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          heroAufgabe ? (
            <HeroBanner
              tone="destructive"
              action={{
                label: lookupKey(heroAufgabe.fields.aufgabe_status) === 'offen' ? 'In Bearbeitung setzen' : 'Als erledigt markieren',
                onClick: () => advanceAufgabe(heroAufgabe),
              }}
            >
              <b>{ueberfaellig.length} überfällige Aufgabe{ueberfaellig.length !== 1 ? 'n' : ''}</b> —{' '}
              „{heroAufgabe.fields.titel ?? 'Aufgabe'}" war fällig am {formatDate(heroAufgabe.fields.faelligkeitsdatum)}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Offen"
              value={aufgaben.filter(a => lookupKey(a.fields.aufgabe_status) === 'offen').length}
              tone="default"
            />
            <StatStripItem
              title="In Bearbeitung"
              value={aufgaben.filter(a => lookupKey(a.fields.aufgabe_status) === 'in_bearbeitung').length}
              tone="primary"
            />
            <StatStripItem
              title="Erledigt"
              value={aufgaben.filter(a => lookupKey(a.fields.aufgabe_status) === 'erledigt').length}
              tone="success"
            />
            <StatStripItem
              title="Projekte aktiv"
              value={aktive.length}
              icon={<IconFolderOpen size={14} />}
              tone={aktive.length === 0 ? 'default' : 'primary'}
            />
            <StatStripItem
              title="Projekte abgeschlossen"
              value={abgeschlossen}
              icon={<IconCheck size={14} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          cards.length === 0 && offeneAufgaben.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <IconClipboardList size={48} className="text-muted-foreground" />
              <div className="text-center">
                <p className="font-semibold text-foreground">Noch keine Aufgaben</p>
                <p className="text-sm text-muted-foreground mt-1">Erstelle dein erstes Projekt und füge Aufgaben hinzu.</p>
              </div>
              <Button
                onClick={() => { setAufgabenDefaults(undefined); setEditAufgabe(undefined); setAufgabenDialogOpen(true); }}
              >
                <IconPlus size={14} className="mr-1.5 shrink-0" />
                Erste Aufgabe erstellen
              </Button>
            </div>
          ) : (
            <KanbanWidget
              cards={cards}
              columns={AUFGABEN_COLUMNS}
              defaultCollapsed={['erledigt']}
              onCardClick={card => {
                const rid = card.id.split(':')[1];
                const aufgabe = aufgaben.find(a => a.record_id === rid);
                if (aufgabe) overlay.replace({ type: 'aufgabe', record: aufgabe });
              }}
              onCardMove={moveCard}
              onAddCard={column => {
                setAufgabenDefaults({ aufgabe_status: column });
                setEditAufgabe(undefined);
                setAufgabenDialogOpen(true);
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title="Fällig & überfällig"
              icon={<IconAlertCircle size={16} className="shrink-0 text-destructive" />}
              items={faelligeAufgaben.map(a => {
                const st = lookupKey(a.fields.aufgabe_status);
                const isOverdue = a.fields.faelligkeitsdatum && isBefore(parseISO(a.fields.faelligkeitsdatum), new Date(today)) && !isToday(parseISO(a.fields.faelligkeitsdatum));
                const enr = enrichedAufgaben.find(e => e.record_id === a.record_id);
                return {
                  id: a.record_id,
                  title: a.fields.titel ?? 'Aufgabe',
                  secondLine: (
                    <>
                      {isOverdue
                        ? <span className="font-medium text-destructive">Überfällig</span>
                        : <span className="font-medium text-warning">Heute fällig</span>}
                      {enr?.projektName ? <span className="text-muted-foreground"> · {enr.projektName}</span> : null}
                    </>
                  ),
                  action: st !== 'erledigt' ? {
                    label: st === 'offen' ? '▶ Starten' : '✓ Erledigt',
                    onClick: () => advanceAufgabe(a),
                  } : undefined,
                };
              })}
              onItemClick={id => {
                const a = aufgaben.find(x => x.record_id === id);
                if (a) overlay.replace({ type: 'aufgabe', record: a });
              }}
              empty={{
                text: (() => {
                  const next = aufgaben
                    .filter(a => lookupKey(a.fields.aufgabe_status) !== 'erledigt' && a.fields.faelligkeitsdatum)
                    .sort((a, b) => (a.fields.faelligkeitsdatum ?? '').localeCompare(b.fields.faelligkeitsdatum ?? ''))[0];
                  return next
                    ? `Alles im Zeitplan — nächste Fälligkeit: ${formatDate(next.fields.faelligkeitsdatum)}`
                    : 'Alle Aufgaben erledigt oder ohne Datum';
                })(),
                action: {
                  label: 'Aufgabe hinzufügen',
                  onClick: () => { setAufgabenDefaults(undefined); setEditAufgabe(undefined); setAufgabenDialogOpen(true); },
                },
              }}
            />
            <WorkList
              title="Aktive Projekte"
              icon={<IconFolderOpen size={16} className="shrink-0" />}
              items={aktive.map(p => {
                const aufgabenCount = aufgaben.filter(a => extractRecordId(a.fields.projekt) === p.record_id && lookupKey(a.fields.aufgabe_status) !== 'erledigt').length;
                return {
                  id: p.record_id,
                  title: p.fields.projektname ?? 'Projekt',
                  secondLine: (
                    <>
                      <span className="text-muted-foreground">
                        {[p.fields.vorname, p.fields.nachname].filter(Boolean).join(' ')}
                        {aufgabenCount > 0 ? ` · ${aufgabenCount} offene Aufgabe${aufgabenCount !== 1 ? 'n' : ''}` : ''}
                      </span>
                      {p.fields.enddatum && (
                        <span className="text-muted-foreground"> · bis {formatDate(p.fields.enddatum)}</span>
                      )}
                    </>
                  ),
                };
              })}
              onItemClick={id => {
                const p = projekte.find(x => x.record_id === id);
                if (p) overlay.replace({ type: 'projekt', record: p });
              }}
              empty={{
                text: projekte.length > 0 ? 'Kein Projekt aktiv — alle abgeschlossen oder geplant' : 'Noch keine Projekte',
                action: {
                  label: 'Projekt anlegen',
                  onClick: () => { setEditProjekt(undefined); setProjekteDialogOpen(true); },
                },
              }}
            />
          </>
        }
      />

      {/* ── Overlay (single host, multi-type stack) ──────────────────────── */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={
          overlay.top?.type === 'aufgabe'
            ? () => { setEditAufgabe(overlay.top!.type === 'aufgabe' ? overlay.top!.record : undefined); setAufgabenDialogOpen(true); overlay.close(); }
            : overlay.top?.type === 'projekt'
            ? () => { setEditProjekt(overlay.top!.type === 'projekt' ? overlay.top!.record : undefined); setProjekteDialogOpen(true); overlay.close(); }
            : undefined
        }
        footer={
          topAufgabe && lookupKey(topAufgabe.fields.aufgabe_status) !== 'erledigt' ? (
            <Button
              size="sm"
              onClick={() => { advanceAufgabe(topAufgabe); overlay.close(); }}
            >
              {lookupKey(topAufgabe.fields.aufgabe_status) === 'offen' ? '▶ In Bearbeitung setzen' : '✓ Als erledigt markieren'}
            </Button>
          ) : undefined
        }
        ariaLabel={overlay.top?.type === 'aufgabe' ? 'Aufgabe' : 'Projekt'}
      >
        {topAufgabe && (
          <>
            <RecordHeader
              title={topAufgabe.fields.titel ?? 'Aufgabe'}
              subtitle={topAufgabe.fields.aufgabe_status?.label}
            />
            <AufgabenDetails
              record={topAufgabe}
              projekteList={projekte}
              onOpenProjekte={p => overlay.push({ type: 'projekt', record: p })}
            />
          </>
        )}
        {topProjekt && (
          <>
            <RecordHeader
              title={topProjekt.fields.projektname ?? 'Projekt'}
              subtitle={topProjekt.fields.status?.label}
            />
            <ProjekteDetails
              record={topProjekt}
              aufgabenList={aufgaben}
              onOpenAufgaben={a => overlay.push({ type: 'aufgabe', record: a })}
              onAddAufgaben={() => {
                setAufgabenDefaults({ projekt: topProjekt.record_id });
                setEditAufgabe(undefined);
                setAufgabenDialogOpen(true);
              }}
            />
          </>
        )}
      </RecordOverlay>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <AufgabenDialog
        open={aufgabenDialogOpen}
        onClose={() => { setAufgabenDialogOpen(false); setEditAufgabe(undefined); setAufgabenDefaults(undefined); }}
        onSubmit={async fields => {
          if (editAufgabe) {
            await LivingAppsService.updateAufgabenEntry(editAufgabe.record_id, fields);
          } else {
            await LivingAppsService.createAufgabenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editAufgabe ? editAufgabe.fields : aufgabenDefaults}
        recordId={editAufgabe?.record_id}
        projekteList={projekte}
        enablePhotoScan={AI_PHOTO_SCAN['Aufgaben']}
      />
      <ProjekteDialog
        open={projekteDialogOpen}
        onClose={() => { setProjekteDialogOpen(false); setEditProjekt(undefined); }}
        onSubmit={async fields => {
          if (editProjekt) {
            await LivingAppsService.updateProjekteEntry(editProjekt.record_id, fields);
          } else {
            await LivingAppsService.createProjekteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editProjekt?.fields}
        recordId={editProjekt?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Projekte']}
      />
    </>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────
function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
