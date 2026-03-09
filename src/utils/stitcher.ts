// Stitches multi-file project files into a single self-contained HTML string
// suitable for rendering in an iframe (no external file references).

export type FileMap = Map<string, string>; // file_path → content

export function buildFileMap(files: { file_path: string; content: string }[]): FileMap {
  return new Map(files.map((f) => [f.file_path, f.content]));
}

// ─── Navigation interceptor ───────────────────────────────────────────────────
// Injected into every page. Intercepts all inter-page link clicks and button
// navigation, then posts a {type:'zai-navigate', page:'pageName'} message to
// the parent React frame, which switches the active preview tab.

const NAV_INTERCEPTOR = `
<script>
(function() {
  function zaiNavigate(raw) {
    if (!raw) return;
    // Strip leading slash, .html extension, pages/ prefix
    var page = raw
      .replace(/^https?:\\/\\/[^/]+/, '')   // strip origin
      .replace(/^\\//, '')                    // strip leading /
      .replace(/^pages\\//, '')              // strip pages/ folder
      .replace(/\\.html$/, '');              // strip .html
    if (!page || page.startsWith('#') || page.startsWith('http') || page.startsWith('mailto')) return;
    window.parent.postMessage({ type: 'zai-navigate', page: page }, '*');
  }

  // Intercept <a> clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    // Walk up the DOM in case click is on a child element of <a>
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href');
    if (!href) return;
    // Let hash-only and external links pass through
    if (href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('http://') || href.startsWith('https://')) return;
    e.preventDefault();
    zaiNavigate(href);
  }, true);

  // Intercept history.pushState / replaceState (for SPA-style navigation)
  ['pushState', 'replaceState'].forEach(function(method) {
    var original = history[method];
    history[method] = function(state, title, url) {
      original.apply(this, arguments);
      if (url) zaiNavigate(String(url));
    };
  });
})();
</script>`;

/**
 * Assembles a page into a fully self-contained HTML string:
 * 1. Replaces <!-- COMPONENT: name --> with component HTML
 * 2. Inlines styles/global.css as <style>
 * 3. Inlines scripts/main.js as <script>
 * 4. Injects the Zai navigation interceptor
 */
export function stitchPage(pagePath: string, files: FileMap): string {
  const pageContent = files.get(pagePath);
  if (!pageContent) return "";

  let html = pageContent;

  // ── 1. Stitch components ─────────────────────────────────────────────────
  html = html.replace(/<!--\s*COMPONENT:\s*(\S+)\s*-->/gi, (_, name) => {
    const componentPath = `components/${name}.html`;
    const componentHtml = files.get(componentPath);
    return componentHtml ?? `<!-- Component "${name}" not found -->`;
  });

  // ── 2. Inline global CSS ──────────────────────────────────────────────────
  const globalCss = files.get("styles/global.css");
  if (globalCss) {
    const linkRe = /<link[^>]*href=["'](?:\.\.\/)?styles\/global\.css["'][^>]*>/gi;
    if (linkRe.test(html)) {
      html = html.replace(linkRe, `<style>\n${globalCss}\n</style>`);
    } else {
      html = html.includes("</head>")
        ? html.replace("</head>", `<style>\n${globalCss}\n</style>\n</head>`)
        : `<style>\n${globalCss}\n</style>\n${html}`;
    }
  }

  // ── 3. Inline global JS ───────────────────────────────────────────────────
  const globalJs = files.get("scripts/main.js");
  if (globalJs) {
    const scriptRe = /<script[^>]*src=["'](?:\.\.\/)?scripts\/main\.js["'][^>]*><\/script>/gi;
    if (scriptRe.test(html)) {
      html = html.replace(scriptRe, `<script>\n${globalJs}\n</script>`);
    } else {
      html = html.includes("</body>")
        ? html.replace("</body>", `<script>\n${globalJs}\n</script>\n</body>`)
        : `${html}\n<script>\n${globalJs}\n</script>`;
    }
  }

  // ── 4. Inject Zai navigation interceptor (before </body> or at end) ───────
  html = html.includes("</body>")
    ? html.replace("</body>", `${NAV_INTERCEPTOR}\n</body>`)
    : `${html}\n${NAV_INTERCEPTOR}`;

  return html;
}

/**
 * Builds a standalone HTML for legacy project_pages (html:PageName format).
 * Injects the same navigation interceptor so tab-switching works.
 */
export function stitchLegacyPage(html: string): string {
  if (html.includes("</body>")) {
    return html.replace("</body>", `${NAV_INTERCEPTOR}\n</body>`);
  }
  return `${html}\n${NAV_INTERCEPTOR}`;
}

/**
 * Normalises a raw page name from a zai-navigate message into a tab identifier.
 * Handles both file-mode paths (pages/dashboard.html) and legacy names (Dashboard).
 */
export function resolveNavigationTarget(
  raw: string,
  pageTabs: string[],   // current list of tab identifiers
): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Exact match first
  const exact = pageTabs.find((t) => t === raw);
  if (exact) return exact;

  // Case-insensitive match against the display name
  const ci = pageTabs.find((t) => {
    const display = t
      .replace(/^pages\//, "")
      .replace(/\.html$/, "")
      .toLowerCase();
    return display === lower;
  });
  return ci ?? null;
}

/**
 * Determines the language for syntax highlighting from a file path.
 */
export function fileLanguage(path: string): string {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".json")) return "json";
  return "text";
}
