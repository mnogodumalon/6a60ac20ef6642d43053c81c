import { useEffect, useState } from 'react';
import {
  IconWorld, IconCheck, IconLink, IconExternalLink, IconLoader2, IconAlertTriangle,
} from '@tabler/icons-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  listPublicPages, setPublished,
  type PublicPageSummary,
} from '@/lib/publicPagesAdmin';

// Owner-facing management of the dashboard's public pages. Same-origin fetch
// to /claude carries the LA session automatically. Anonymous visitors never
// reach this — it lives inside the authenticated Layout.

const T = {
  title: 'Öffentliche Seiten',
  subtitle: 'Formulare und Seiten, die du per Link teilen kannst — ohne dass Besucher ein Konto brauchen.',
  empty: 'Noch keine Seiten. Nach dem nächsten Build steht pro Datenbereich ein Formular bereit.',
  origin_auto: 'Vorschlag',
  origin_user: 'Eigene',
  origin_agent: 'KI-Seite',
  status_published: 'Öffentlich',
  status_draft: 'Entwurf',
  publish: 'Veröffentlichen',
  pause: 'Pausieren',
  open: 'Öffnen',
  copy: 'Link kopieren',
  copied: 'Kopiert!',
  confirm_title: 'Wirklich veröffentlichen?',
  can_do: 'Jeder mit dem Link kann:',
  cannot_do: 'Niemand kann:',
  can_submit: 'Einträge absenden',
  can_view: 'diese Daten sehen',
  cannot_line: 'bestehende Daten sehen oder ändern.',
  cancel: 'Abbrechen',
  confirm_publish: 'Veröffentlichen',
};

function originLabel(o: string): string {
  return o === 'auto' ? T.origin_auto : o === 'agent' ? T.origin_agent : T.origin_user;
}

// Plain-language summary of what a page's link grants — the owner confirms
// THIS, never the underlying policy. Built from the field/endpoint config.
function capabilities(page: PublicPageSummary): { submit?: string; view?: string } {
  const out: { submit?: string; view?: string } = {};
  if (page.type === 'custom' && page.endpoints) {
    const create = page.endpoints.find(e => e.op === 'create');
    const list = page.endpoints.find(e => e.op === 'list');
    if (create) out.submit = create.fields.map(f => f.label).join(', ');
    if (list) out.view = list.scope_description || list.fields.map(f => f.label).join(', ');
  } else {
    out.submit = page.fields.map(f => f.label).join(', ');
  }
  return out;
}

export default function PublicPagesAdmin() {
  const [pages, setPages] = useState<Record<string, PublicPageSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const load = async () => {
    try {
      setPages(await listPublicPages());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const applyPublished = async (slug: string, published: boolean) => {
    setBusySlug(slug);
    setConfirmSlug(null);
    try {
      const updated = await setPublished(slug, published);
      setPages(prev => ({ ...prev, [slug]: updated }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlug(null);
    }
  };

  const copy = async (page: PublicPageSummary) => {
    try {
      await navigator.clipboard.writeText(page.share_url);
      setCopiedSlug(page.slug);
      setTimeout(() => setCopiedSlug(c => (c === page.slug ? null : c)), 1500);
    } catch {
      // clipboard unavailable — the open link still works
    }
  };

  const entries = Object.values(pages).sort((a, b) => a.title.localeCompare(b.title));
  const confirmPage = confirmSlug ? pages[confirmSlug] : null;
  const caps = confirmPage ? capabilities(confirmPage) : {};

  return (
    <PageShell title={T.title} subtitle={T.subtitle}>
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <IconAlertTriangle size={18} stroke={1.5} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <IconLoader2 size={28} stroke={1.5} className="animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[27px] bg-card shadow-lg p-8 text-center text-muted-foreground">
          {T.empty}
        </div>
      ) : (
        <div className="rounded-[27px] bg-card shadow-lg overflow-hidden divide-y divide-border">
          {entries.map(page => (
            <div key={page.slug} className="flex items-center gap-4 px-6 py-4 min-w-0">
              <IconWorld size={20} stroke={1.5} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{page.title}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {originLabel(page.origin)}
                  </span>
                </div>
                <span className={`text-xs ${page.published ? 'text-primary' : 'text-muted-foreground'}`}>
                  {page.published ? T.status_published : T.status_draft}
                </span>
              </div>

              {page.published ? (
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={page.share_url}
                    target="_blank"
                    rel="noreferrer"
                    title={T.open}
                    aria-label={T.open}
                    className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <IconExternalLink size={18} stroke={1.5} />
                  </a>
                  <button
                    type="button"
                    title={copiedSlug === page.slug ? T.copied : T.copy}
                    aria-label={T.copy}
                    onClick={() => copy(page)}
                    className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {copiedSlug === page.slug ? <IconCheck size={18} stroke={1.5} /> : <IconLink size={18} stroke={1.5} />}
                  </button>
                </div>
              ) : null}

              <Button
                variant={page.published ? 'outline' : 'default'}
                size="sm"
                className="shrink-0"
                disabled={busySlug === page.slug}
                onClick={() =>
                  page.published ? applyPublished(page.slug, false) : setConfirmSlug(page.slug)
                }
              >
                {busySlug === page.slug ? (
                  <IconLoader2 size={16} stroke={1.5} className="animate-spin" />
                ) : page.published ? (
                  T.pause
                ) : (
                  T.publish
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmPage} onOpenChange={v => !v && setConfirmSlug(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{T.confirm_title}</DialogTitle>
            <DialogDescription>{confirmPage?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {caps.submit ? (
              <p><span className="font-medium">{T.can_do}</span> {T.can_submit} <span className="text-muted-foreground">({caps.submit})</span></p>
            ) : null}
            {caps.view ? (
              <p><span className="font-medium">{T.can_do}</span> {T.can_view} <span className="text-muted-foreground">({caps.view})</span></p>
            ) : null}
            <p><span className="font-medium">{T.cannot_do}</span> {T.cannot_line}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSlug(null)}>{T.cancel}</Button>
            <Button onClick={() => confirmPage && applyPublished(confirmPage.slug, true)}>
              {T.confirm_publish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
