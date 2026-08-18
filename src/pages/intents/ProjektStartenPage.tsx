/**
 * Projekt starten — 2-Schritt-Wizard.
 * Steps: 1) Projekt anlegen (Formular) → 2) Aufgaben hinzufügen (optional, wiederholbar).
 * Reads: (keine — Step 1 startet mit leerem Formular, Step 2 listet erstellte Aufgaben lokal).
 * Writes: projekte (createProjekteEntry), aufgaben (createAufgabenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconPlus, IconCircleCheck, IconCalendar, IconUser, IconFlag, IconTrash } from '@tabler/icons-react';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { format } from 'date-fns';

// Lookup options – read inside component body for locale-aware labels
const PROJEKT_STATUS = LOOKUP_OPTIONS['projekte']?.['status'] ?? [];
const PRIORITAET_OPTIONS = LOOKUP_OPTIONS['aufgaben']?.['prioritaet'] ?? [];

interface ErstellteAufgabe {
  id: string;
  titel: string;
  prioritaetKey: string;
  faelligkeitsdatum: string;
  zustaendig: string;
}

export default function ProjektStartenPage() {
  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Projekt form state
  const [projektname, setProjektname] = useState('');
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [startdatum, setStartdatum] = useState('');
  const [enddatum, setEnddatum] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [statusKey, setStatusKey] = useState(PROJEKT_STATUS[0]?.key ?? 'geplant');
  const [projektSaving, setProjektSaving] = useState(false);
  const [projektError, setProjektError] = useState('');

  // Created project id (used in step 2)
  const [neueProjektId, setNeueProjektId] = useState<string | null>(null);
  const [neueProjektname, setNeueProjektname] = useState('');

  // Step 2 — Aufgabe form state
  const [aufgabeTitel, setAufgabeTitel] = useState('');
  const [aufgabePrioritaet, setAufgabePrioritaet] = useState(PRIORITAET_OPTIONS[1]?.key ?? 'mittel');
  const [aufgabeFaelligkeit, setAufgabeFaelligkeit] = useState('');
  const [aufgabeVorname, setAufgabeVorname] = useState('');
  const [aufgabeNachname, setAufgabeNachname] = useState('');
  const [aufgabeSaving, setAufgabeSaving] = useState(false);
  const [aufgabeError, setAufgabeError] = useState('');

  // Locally tracked created tasks
  const [erstellteAufgaben, setErstellteAufgaben] = useState<ErstellteAufgabe[]>([]);

  // Done state
  const [done, setDone] = useState(false);

  // ── Step 1: Projekt anlegen ───────────────────────────────────────────────

  const handleProjektAnlegen = async () => {
    if (!projektname.trim() || !vorname.trim() || !nachname.trim() || !startdatum) return;
    if (neueProjektId) {
      // Already created (retry guard) — just advance
      setStep(2);
      return;
    }
    setProjektSaving(true);
    setProjektError('');
    try {
      const result = await LivingAppsService.createProjekteEntry({
        projektname: projektname.trim(),
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        startdatum,
        enddatum: enddatum || undefined,
        beschreibung: beschreibung.trim() || undefined,
        status: statusKey,
      });
      setNeueProjektId(result.record_id);
      setNeueProjektname(projektname.trim());
      setStep(2);
    } catch {
      setProjektError(tx('Projekt konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setProjektSaving(false);
    }
  };

  // ── Step 2: Aufgabe hinzufügen ────────────────────────────────────────────

  const handleAufgabeHinzufuegen = async () => {
    if (!aufgabeTitel.trim() || !neueProjektId) return;
    setAufgabeSaving(true);
    setAufgabeError('');
    try {
      const result = await LivingAppsService.createAufgabenEntry({
        titel: aufgabeTitel.trim(),
        prioritaet: aufgabePrioritaet,
        faelligkeitsdatum: aufgabeFaelligkeit || undefined,
        zustaendig_vorname: aufgabeVorname.trim() || undefined,
        zustaendig_nachname: aufgabeNachname.trim() || undefined,
        aufgabe_status: 'offen',
        projekt: createRecordUrl(APP_IDS.PROJEKTE, neueProjektId),
      });

      const zustaendig = [aufgabeVorname.trim(), aufgabeNachname.trim()].filter(Boolean).join(' ');
      setErstellteAufgaben(prev => [
        ...prev,
        {
          id: result.record_id,
          titel: aufgabeTitel.trim(),
          prioritaetKey: aufgabePrioritaet,
          faelligkeitsdatum: aufgabeFaelligkeit,
          zustaendig,
        },
      ]);

      // Reset aufgabe form for next entry
      setAufgabeTitel('');
      setAufgabeFaelligkeit('');
      setAufgabeVorname('');
      setAufgabeNachname('');
      setAufgabePrioritaet(PRIORITAET_OPTIONS[1]?.key ?? 'mittel');
    } catch {
      setAufgabeError(tx('Aufgabe konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setAufgabeSaving(false);
    }
  };

  const handleFertig = () => {
    setDone(true);
  };

  const handleReset = () => {
    setProjektname('');
    setVorname('');
    setNachname('');
    setStartdatum('');
    setEnddatum('');
    setBeschreibung('');
    setStatusKey(PROJEKT_STATUS[0]?.key ?? 'geplant');
    setNeueProjektId(null);
    setNeueProjektname('');
    setAufgabeTitel('');
    setAufgabePrioritaet(PRIORITAET_OPTIONS[1]?.key ?? 'mittel');
    setAufgabeFaelligkeit('');
    setAufgabeVorname('');
    setAufgabeNachname('');
    setErstellteAufgaben([]);
    setDone(false);
    setProjektError('');
    setAufgabeError('');
    setStep(1);
  };

  // ── Priority label helper ─────────────────────────────────────────────────

  const getPrioritaetLabel = (key: string) =>
    PRIORITAET_OPTIONS.find(o => o.key === key)?.label ?? key;

  const getPrioritaetColor = (key: string) => {
    if (key === 'hoch') return 'bg-red-100 text-red-700 border-red-200';
    if (key === 'mittel') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  // ── Done screen ───────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <IconCircleCheck size={64} className="text-emerald-500" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {tx('Projekt gestartet!')}
            </h2>
            <p className="text-muted-foreground">
              {tx('Das Projekt')} <span className="font-medium text-foreground">„{neueProjektname}"</span>{' '}
              {tx('wurde angelegt')}{erstellteAufgaben.length > 0
                ? ` ${tx('mit')} ${erstellteAufgaben.length} ${erstellteAufgaben.length === 1 ? tx('Aufgabe') : tx('Aufgaben')}.`
                : '.'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleReset} variant="outline" className="w-full">
              {tx('Weiteres Projekt anlegen')}
            </Button>
            <a href="#/" className="block">
              <Button className="w-full">
                {tx('Zurück zum Dashboard')}
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  return (
    <IntentWizardShell
      title={tx('Projekt starten')}
      subtitle={tx('Neues Projekt anlegen und erste Aufgaben erstellen')}
      steps={[
        { label: tx('Projekt') },
        { label: tx('Aufgaben') },
      ]}
      currentStep={step}
      onStepChange={setStep}
    >
      {/* ── Step 1: Projekt anlegen ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{tx('Projektdetails')}</h3>
            <p className="text-sm text-muted-foreground">
              {tx('Gib die grundlegenden Informationen zum neuen Projekt ein.')}
            </p>
          </div>

          <div className="space-y-4">
            {/* Projektname */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Projektname')} <span className="text-destructive">*</span>
              </label>
              <Input
                value={projektname}
                onChange={e => setProjektname(e.target.value)}
                placeholder={tx('z. B. Website-Relaunch')}
                autoFocus
              />
            </div>

            {/* Verantwortliche Person */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Verantwortliche Person')} <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={vorname}
                  onChange={e => setVorname(e.target.value)}
                  placeholder={tx('Vorname')}
                />
                <Input
                  value={nachname}
                  onChange={e => setNachname(e.target.value)}
                  placeholder={tx('Nachname')}
                />
              </div>
            </div>

            {/* Zeitraum */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Zeitraum')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tx('Start')} <span className="text-destructive">*</span></span>
                  <Input
                    type="date"
                    value={startdatum}
                    onChange={e => setStartdatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tx('Ende (optional)')}</span>
                  <Input
                    type="date"
                    value={enddatum}
                    onChange={e => setEnddatum(e.target.value)}
                    min={startdatum || undefined}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Status')} <span className="text-destructive">*</span>
              </label>
              <Select value={statusKey} onValueChange={setStatusKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJEKT_STATUS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Beschreibung (optional)')}
              </label>
              <Textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder={tx('Kurze Beschreibung des Projekts, Ziele, Hintergrund …')}
                rows={3}
              />
            </div>
          </div>

          {projektError && (
            <p className="text-sm text-destructive">{projektError}</p>
          )}

          <div className="pt-2">
            <Button
              className="w-full"
              disabled={!projektname.trim() || !vorname.trim() || !nachname.trim() || !startdatum || projektSaving}
              onClick={handleProjektAnlegen}
            >
              {projektSaving ? tx('Wird angelegt …') : tx('Projekt anlegen & weiter')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Aufgaben hinzufügen ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {neueProjektId ? (
            <>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {tx('Aufgaben für')} „{neueProjektname}"
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tx('Füge jetzt erste Aufgaben hinzu. Du kannst diesen Schritt auch überspringen.')}
                </p>
              </div>

              {/* Bereits erstellte Aufgaben */}
              {erstellteAufgaben.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Bereits hinzugefügt')} ({erstellteAufgaben.length})
                  </p>
                  <ul className="space-y-2">
                    {erstellteAufgaben.map(a => (
                      <li
                        key={a.id}
                        className="rounded-xl border bg-card px-4 py-3 flex items-start gap-3"
                      >
                        <IconCircleCheck size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{a.titel}</p>
                          <div className="flex flex-wrap gap-2 mt-1 items-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getPrioritaetColor(a.prioritaetKey)}`}>
                              {getPrioritaetLabel(a.prioritaetKey)}
                            </span>
                            {a.faelligkeitsdatum && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconCalendar size={12} className="shrink-0" />
                                {a.faelligkeitsdatum}
                              </span>
                            )}
                            {a.zustaendig && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconUser size={12} className="shrink-0" />
                                {a.zustaendig}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mini-Formular neue Aufgabe */}
              <div className="rounded-2xl border bg-secondary/30 p-4 space-y-4">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <IconPlus size={16} className="shrink-0 text-primary" />
                  {tx('Neue Aufgabe')}
                </p>

                {/* Titel */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Titel')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={aufgabeTitel}
                    onChange={e => setAufgabeTitel(e.target.value)}
                    placeholder={tx('z. B. Konzept erstellen')}
                  />
                </div>

                {/* Priorität */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Priorität')} <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITAET_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setAufgabePrioritaet(opt.key)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          aufgabePrioritaet === opt.key
                            ? getPrioritaetColor(opt.key) + ' ring-2 ring-offset-1 ring-primary/30'
                            : 'bg-card text-muted-foreground border-border hover:bg-secondary'
                        }`}
                      >
                        <IconFlag size={13} className="inline mr-1 shrink-0" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fälligkeit + Zuständig */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {tx('Fälligkeitsdatum (optional)')}
                    </label>
                    <Input
                      type="date"
                      value={aufgabeFaelligkeit}
                      onChange={e => setAufgabeFaelligkeit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {tx('Zuständig (optional)')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={aufgabeVorname}
                        onChange={e => setAufgabeVorname(e.target.value)}
                        placeholder={tx('Vorname')}
                        className="flex-1 min-w-0"
                      />
                      <Input
                        value={aufgabeNachname}
                        onChange={e => setAufgabeNachname(e.target.value)}
                        placeholder={tx('Nachname')}
                        className="flex-1 min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {aufgabeError && (
                  <p className="text-sm text-destructive">{aufgabeError}</p>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!aufgabeTitel.trim() || aufgabeSaving}
                  onClick={handleAufgabeHinzufuegen}
                >
                  <IconPlus size={16} className="mr-2 shrink-0" />
                  {aufgabeSaving ? tx('Wird gespeichert …') : tx('Aufgabe hinzufügen')}
                </Button>
              </div>

              {/* Footer actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFertig}
                >
                  {erstellteAufgaben.length > 0
                    ? tx('Fertig')
                    : tx('Ohne Aufgaben abschließen')}
                </Button>
              </div>
            </>
          ) : (
            /* Reload fallback — project not in state */
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt benötigt ein zuvor angelegtes Projekt.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
