/**
 * Aufgabe erledigen — 2-Schritt-Wizard.
 * Steps: 1) Offene/in-Bearbeitung-Aufgabe auswählen → 2) Status auf 'erledigt' setzen (opt. Abschlussnotiz).
 * Reads: aufgaben, projekte. Writes: aufgaben (updateAufgabenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAufgaben } from '@/lib/enrich';
import type { EnrichedAufgaben } from '@/types/enriched';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { IconCheck, IconCircleCheck, IconNotes } from '@tabler/icons-react';

export default function AufgabeErledigePage() {
  const data = useDashboardData();
  const { aufgaben, projekteMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAufgabe, setSelectedAufgabe] = useState<EnrichedAufgaben | null>(null);
  const [notiz, setNotiz] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedAufgaben = enrichAufgaben(aufgaben, { projekteMap });

  const eligibleAufgaben = enrichedAufgaben.filter(
    (a) =>
      a.fields.aufgabe_status?.key === 'offen' ||
      a.fields.aufgabe_status?.key === 'in_bearbeitung'
  );

  const handleSelectAufgabe = (id: string) => {
    const found = eligibleAufgaben.find((a) => a.record_id === id) ?? null;
    setSelectedAufgabe(found);
    setNotiz(found?.fields.aufgabe_beschreibung ?? '');
    setSaveError(null);
    setStep(2);
  };

  const handleMarkErledigt = async () => {
    if (!selectedAufgabe) return;
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.updateAufgabenEntry(selectedAufgabe.record_id, {
        aufgabe_status: 'erledigt',
        aufgabe_beschreibung: notiz.trim() || undefined,
      });
      await fetchAll();
      setDone(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : tx('Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedAufgabe(null);
    setNotiz('');
    setSaveError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Aufgabe erledigen')}
      subtitle={tx('Offene Aufgabe auswählen und als erledigt markieren')}
      steps={[{ label: tx('Aufgabe wählen') }, { label: tx('Bestätigen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Aufgabe auswählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleAufgaben.map((a) => ({
            id: a.record_id,
            title: a.fields.titel ?? tx('Ohne Titel'),
            subtitle: [
              a.projektName ? a.projektName : null,
              a.fields.faelligkeitsdatum
                ? tx('Fällig') + ': ' + formatDate(a.fields.faelligkeitsdatum)
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.aufgabe_status
              ? { key: a.fields.aufgabe_status.key, label: a.fields.aufgabe_status.label }
              : undefined,
            stats: a.fields.prioritaet
              ? [{ label: tx('Priorität'), value: a.fields.prioritaet.label }]
              : [],
            icon: <IconNotes size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAufgabe}
          searchPlaceholder={tx('Aufgabe suchen …')}
          emptyText={tx('Keine offenen oder in Bearbeitung befindlichen Aufgaben')}
          emptyIcon={<IconCircleCheck size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Step 2: Bestätigen ── */}
      {step === 2 && (
        <div>
          {selectedAufgabe ? (
            <div className="space-y-6">
              {/* Zusammenfassung */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="text-base font-semibold text-foreground">
                  {tx('Aufgabe abschließen')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('Titel')}</p>
                    <p className="font-medium text-foreground">
                      {selectedAufgabe.fields.titel ?? tx('Ohne Titel')}
                    </p>
                  </div>

                  {selectedAufgabe.projektName && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">{tx('Projekt')}</p>
                      <p className="font-medium text-foreground">{selectedAufgabe.projektName}</p>
                    </div>
                  )}

                  {selectedAufgabe.fields.prioritaet && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">{tx('Priorität')}</p>
                      <p className="font-medium text-foreground">
                        {selectedAufgabe.fields.prioritaet.label}
                      </p>
                    </div>
                  )}

                  {selectedAufgabe.fields.faelligkeitsdatum && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">{tx('Fälligkeitsdatum')}</p>
                      <p className="font-medium text-foreground">
                        {formatDate(selectedAufgabe.fields.faelligkeitsdatum)}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('Bisheriger Status')}</p>
                    <StatusBadge
                      statusKey={selectedAufgabe.fields.aufgabe_status?.key}
                      label={selectedAufgabe.fields.aufgabe_status?.label}
                    />
                  </div>
                </div>
              </div>

              {/* Optionale Abschlussnotiz */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="abschluss-notiz">
                  {tx('Abschlussnotiz')}
                  <span className="ml-1 text-xs text-muted-foreground">{tx('(optional)')}</span>
                </label>
                <Textarea
                  id="abschluss-notiz"
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  placeholder={tx('Ergänze eine Notiz zum Abschluss …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Fehler */}
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}

              {/* Aktionen */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  onClick={handleMarkErledigt}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  <IconCheck size={16} className="shrink-0" />
                  {saving ? tx('Wird gespeichert …') : tx('Erledigt markieren')}
                </Button>
              </div>
            </div>
          ) : (
            /* Deep-link fallback: Schritt 2 ohne Auswahl */
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Erfolgsmeldung ── */}
      {done && (
        <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
          <IconCircleCheck size={48} className="text-emerald-500" stroke={1.5} />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              {tx('Aufgabe erledigt!')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedAufgabe?.fields.titel
                ? tx('Die Aufgabe wurde als erledigt markiert.')
                : tx('Die Aufgabe wurde als erledigt markiert.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" onClick={handleReset}>
              {tx('Weitere Aufgabe erledigen')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
