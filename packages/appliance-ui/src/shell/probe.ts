/**
 * The shell's probe: `GET /api/branding`, because it is the cheapest public
 * answer and carries the build. Its failure is the daemon gone — the session
 * is asked again so the answer says so — and its return is the daemon back.
 *
 * One probe in flight at a time: a box that is rebooting can leave a fetch
 * unanswered until its timeout, and a probe started meanwhile would only add
 * to the requests waiting on it. None while the tab is hidden, and one as soon
 * as it is shown again.
 *
 * An answer from a different build means the daemon was upgraded under an
 * open tab, so the page reloads rather than resumes the previous release.
 * When no first answer ever came the build this page was served with is
 * unknown, and the page reloads on the first rather than trusting it — unless
 * something was rendered from the other first answers, which a blip on this
 * one alone must not throw away. An answer naming another hostname is a
 * rename, and is shown in place of the last.
 */
import type { BrandingView } from "@wired-square/appliance-types";

/** What the probe reads of the shell, and what it does to it. */
export interface Probed {
  /** Whether the shell is already asking; a probe skips its turn while it is. */
  busy(): boolean;
  /** The branding shown, whose build is the one this page was served with. */
  page(): BrandingView | undefined;
  /** The ETag the first answer came with. */
  tag(): string | undefined;
  /** Whether anything was rendered from the other first answers. */
  rendered(): boolean;
  /** Show `got`: the first answer, which never came, or one naming a renamed box. */
  adopt(got: BrandingView): void;
  reload(): void;
  /** Whether the last ask of the session failed. */
  failed(): boolean;
  reask(): void;
}

/**
 * Probe `branding` every `ms`, giving each probe `ms` to answer, until the
 * returned function is called.
 */
export function startProbe(shell: Probed, ms: number, branding = "/api/branding"): () => void {
  let last: { etag: string; view: BrandingView } | undefined;
  let asking: AbortController | undefined;
  let stopped = false;

  // `no-store` stops the browser answering or adding its own conditional, so a
  // 304 is the answer `last` was.
  const ask = async (): Promise<BrandingView> => {
    const controller = (asking = new AbortController());
    const timeout = setTimeout(() => controller.abort(), ms);
    if (!last) {
      const page = shell.page();
      const tag = shell.tag();
      if (page && tag) last = { etag: tag, view: page };
    }
    try {
      const response = await fetch(branding, {
        cache: "no-store",
        credentials: "same-origin",
        headers: last ? { "if-none-match": last.etag } : {},
        signal: controller.signal,
      });
      if (response.status === 304 && last) return last.view;
      if (!response.ok) throw new Error(`GET /api/branding answered ${response.status}`);
      const view = (await response.json()) as BrandingView;
      const etag = response.headers.get("etag");
      last = etag === null ? undefined : { etag, view };
      return view;
    } finally {
      clearTimeout(timeout);
    }
  };

  let probing = false;
  const probe = async () => {
    if (probing || document.hidden || shell.busy()) return;
    probing = true;
    try {
      const got = await ask();
      if (stopped) return;
      const page = shell.page();
      if (page ? got.build !== page.build : !shell.rendered()) {
        shell.reload();
      } else if (!page || got.hostname !== page.hostname) {
        shell.adopt(got);
      }
      if (shell.failed()) shell.reask();
    } catch {
      if (!stopped && !shell.failed()) shell.reask();
    } finally {
      probing = false;
    }
  };

  const timer = setInterval(probe, ms);
  document.addEventListener("visibilitychange", probe);
  return () => {
    stopped = true;
    asking?.abort();
    clearInterval(timer);
    document.removeEventListener("visibilitychange", probe);
  };
}
