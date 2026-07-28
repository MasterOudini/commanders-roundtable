import { create } from 'zustand';
import { countCards, groupBySection, parseDecklist } from '../data/decklist';
import { pickCommanders } from '../data/pickCommanders';
import { validateCommanderDeck } from '../data/validate';
import type { DeckEntry, DeckFile, ParsedDecklist, ResolvedEntry, ValidationReport } from '../data/deckTypes';
import type { DeckSummary } from '../types/bridge';

// Deck list, import, and validation.
//
// The split of work: parsing is local and synchronous (pure text), name resolution
// is one batched IPC call to the worker, and validation is local again once the
// cards are in hand. So a paste validates in a single round trip regardless of
// deck size.

export interface ImportPreview {
  parsed: ParsedDecklist;
  commanders: ResolvedEntry[];
  main: ResolvedEntry[];
  sideboard: ResolvedEntry[];
  report: ValidationReport;
  /** Cards whose names did not resolve, for the fix-up list. */
  unresolved: ResolvedEntry[];
  /**
   * Set only when the list had no Commander heading and the cards decided it —
   * says which cards were chosen and why. Shown, never silent: a commander the
   * player did not pick is exactly the thing they need to be told about.
   */
  detected?: string;
}

/** What came back from a deck link, for the screen to put in front of the user. */
export interface FetchedImport {
  text: string;
  /** The deck's name on the site, when it had one. */
  name: string;
  sourceUrl: string;
  /** False when the site's list did not say which card is the commander. */
  commanderKnown: boolean;
}

interface DeckState {
  decks: DeckSummary[];
  loading: boolean;
  preview: ImportPreview | null;
  previewing: boolean;
  fetching: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  /** Parse + resolve + validate a paste. Does not save anything. */
  buildPreview: (text: string, promoteFirstAsCommander?: boolean) => Promise<void>;
  /**
   * Download a decklist by link and preview it. Returns what was downloaded so
   * the screen can show the text it is about to import; null when the link
   * failed, with the reason in `error`.
   */
  importFromUrl: (url: string, promoteFirstAsCommander?: boolean) => Promise<FetchedImport | null>;
  clearPreview: () => void;
  /** Save the current preview as a deck and queue its art. */
  savePreview: (name: string) => Promise<DeckFile | null>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
}

export const useDecks = create<DeckState>((set, get) => ({
  decks: [],
  loading: false,
  preview: null,
  previewing: false,
  fetching: false,
  error: null,

  refresh: async () => {
    const bridge = window.crt;
    if (!bridge) return;
    set({ loading: true });
    try {
      set({ decks: await bridge.decks.list(), error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  buildPreview: async (text, promoteFirstAsCommander = false) => {
    const bridge = window.crt;
    set({ previewing: true, error: null });
    try {
      const parsed = parseDecklist(text);
      const grouped = groupBySection(parsed);

      // ⚠️ A list with no Commander heading is worked out AFTER resolution, not
      // here — see `pickCommanders`. Every question that decides it is a question
      // about the card, and nothing here has any cards yet.
      const commanderEntries = grouped.commanders;
      const mainEntries = grouped.main;

      if (!bridge) {
        // Browser dev session: show the parse, skip resolution.
        set({
          preview: {
            parsed,
            commanders: commanderEntries.map((entry) => ({ entry, card: null })),
            main: mainEntries.map((entry) => ({ entry, card: null })),
            sideboard: grouped.sideboard.map((entry) => ({ entry, card: null })),
            report: validateCommanderDeck([], [], []),
            unresolved: [],
          },
        });
        return;
      }

      // One call for the whole list.
      const all = [...commanderEntries, ...mainEntries, ...grouped.sideboard];
      const resolved = await bridge.cardDb.resolveNames(
        all.map((e) => ({
          name: e.name,
          ...(e.set !== undefined ? { set: e.set } : {}),
          ...(e.collectorNumber !== undefined ? { collectorNumber: e.collectorNumber } : {}),
        })),
      );

      // Pair results back up positionally — resolveNames preserves order.
      const pair = (entries: DeckEntry[], offset: number): ResolvedEntry[] =>
        entries.map((entry, i) => {
          const r = resolved[offset + i];
          return {
            entry,
            card: r?.card ?? null,
            ...(r?.suggestions?.length ? { suggestions: r.suggestions } : {}),
          };
        });

      let commanders = pair(commanderEntries, 0);
      let main = pair(mainEntries, commanderEntries.length);
      const sideboard = pair(grouped.sideboard, commanderEntries.length + mainEntries.length);

      // ⚠️ NOW the cards are in hand, so the list can be asked who its commander
      // is — including whether that commander allows a second one. Only when the
      // list did not say: a `Commander` heading is the author's answer and wins.
      let detected: string | null = null;
      if (commanders.length === 0 && promoteFirstAsCommander) {
        const picked = pickCommanders(main);
        commanders = picked.commanders;
        main = picked.main;
        detected = picked.note;
      }

      const status = await bridge.cardDb.status().catch(() => null);
      const report = validateCommanderDeck(commanders, main, sideboard, {
        cardDataUpdatedAt: status?.updatedAt ?? null,
      });

      set({
        preview: {
          parsed,
          commanders,
          main,
          sideboard,
          report,
          unresolved: [...commanders, ...main].filter((r) => !r.card),
          ...(detected !== null ? { detected } : {}),
        },
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ previewing: false });
    }
  },

  importFromUrl: async (url, promoteFirstAsCommander = false) => {
    const bridge = window.crt;
    if (!bridge) {
      // A browser dev session has no main process, so no network at all.
      set({ error: 'Importing from a link needs the desktop app. Paste the decklist instead.' });
      return null;
    }

    set({ fetching: true, error: null });
    try {
      const result = await bridge.decks.fetchUrl(url);
      if (!result.ok) {
        set({ error: result.message });
        return null;
      }
      // The download is only text: it goes through the same parse, the same
      // resolution and the same preview a pasted list does.
      await get().buildPreview(result.text, promoteFirstAsCommander);
      return {
        text: result.text,
        name: result.name,
        sourceUrl: result.sourceUrl,
        commanderKnown: result.commanderKnown,
      };
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      set({ fetching: false });
    }
  },

  clearPreview: () => set({ preview: null, error: null }),

  savePreview: async (name) => {
    const bridge = window.crt;
    const preview = get().preview;
    if (!bridge || !preview) return null;

    const saved = await bridge.decks.save({
      name,
      commanders: preview.commanders.map((r) => r.entry),
      main: preview.main.map((r) => r.entry),
      sideboard: preview.sideboard.map((r) => r.entry),
      houseRuled: false,
      sourceText: preview.parsed.entries.map((e) => e.raw).join('\n'),
    });

    if (saved) {
      // Queue this deck's art now, so it is ready before the first game.
      const ids = [...preview.commanders, ...preview.main]
        .map((r) => r.card?.scryfallId)
        .filter((id): id is string => !!id);
      if (ids.length > 0) void bridge.images.prefetch(ids);
      await get().refresh();
    }
    return saved;
  },

  remove: async (id) => {
    await window.crt?.decks.delete(id);
    await get().refresh();
  },

  duplicate: async (id) => {
    await window.crt?.decks.duplicate(id);
    await get().refresh();
  },
}));

export { countCards };
