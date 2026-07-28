// Shared control classes for the play surface.
//
// ⚠️ LITERAL STRINGS, always. Tailwind 4 scans source text for class names, so
// a class composed at runtime (`px-${n}`, or a template that builds
// `bg-crt-${tone}`) is never emitted at all — the element simply has no
// padding and nothing warns. Keeping the whole class list in one literal
// constant per control is what makes that impossible to get wrong by accident,
// and it is why these are constants rather than a `button(variant)` helper.

export const BTN =
  'inline-flex items-center gap-1.5 rounded border border-crt-accent-lo bg-crt-accent px-3 py-1.5 text-sm text-crt-on-accent hover:bg-crt-accent-hi disabled:opacity-40 disabled:hover:bg-crt-accent';

export const BTN_SMALL =
  'inline-flex items-center gap-1 rounded border border-crt-accent-lo bg-crt-accent px-2 py-1 text-xs text-crt-on-accent hover:bg-crt-accent-hi disabled:opacity-40 disabled:hover:bg-crt-accent';

export const BTN_GHOST =
  'inline-flex items-center gap-1.5 rounded border border-crt-border bg-crt-raised px-3 py-1.5 text-sm text-crt-dim hover:border-crt-border-hi hover:text-crt-text disabled:opacity-40';

export const BTN_GHOST_SMALL =
  'inline-flex items-center gap-1 rounded border border-crt-border bg-crt-raised px-2 py-1 text-xs text-crt-dim hover:border-crt-border-hi hover:text-crt-text disabled:opacity-40';

export const PANEL =
  'rounded-lg border border-crt-border bg-crt-raised/95 p-3 shadow-xl backdrop-saturate-150';

export const FIELD =
  'w-full rounded border border-crt-border bg-crt-void px-2 py-1 text-sm text-crt-text';

export const LABEL = 'block text-[11px] uppercase tracking-wider text-crt-faint';
