import { create } from 'zustand';

// What the solo lobby has been set to: how many seats, and which deck sits at
// each of them.
//
// ⚠️ In a STORE rather than the screen's own state, for one reason: the screen
// unmounts the moment you leave it, and the second setup of a session is almost
// always a rematch. Re-picking four decks to change one is the kind of friction
// that makes a finished feature feel unfinished.
//
// In memory only, deliberately. A choice that survived a restart would belong in
// the main-process settings schema — and every key there must have a control on
// the Settings screen (the probe asserts exactly that), which is a bigger claim
// than "remember what I picked a minute ago".

/** The engine seats 2–4; `startSolo` clamps to the same range. */
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;

interface SoloSetup {
  seats: number;
  /** Deck id per seat index. `null` means "use a starter deck". */
  deckIds: readonly (string | null)[];
  /**
   * Which seats a bot plays.
   *
   * ⚠️ Seat 0 is always a person — a table with nobody at it is a tournament
   * run, and that belongs in a script rather than behind a lobby button. The
   * setter enforces it rather than the screen, so there is one place to check.
   */
  bots: readonly boolean[];
  setSeats: (seats: number) => void;
  setDeck: (index: number, deckId: string | null) => void;
  setBot: (index: number, isBot: boolean) => void;
  /** A deck that no longer exists must not stay selected. */
  dropMissingDecks: (existing: readonly string[]) => void;
}

export const useSolo = create<SoloSetup>((set) => ({
  seats: MAX_SEATS,
  deckIds: Array.from({ length: MAX_SEATS }, () => null),
  bots: Array.from({ length: MAX_SEATS }, () => false),

  setSeats: (seats) =>
    set({ seats: Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(seats) || MIN_SEATS)) }),

  setBot: (index, isBot) =>
    set((s) => {
      if (index <= 0 || index >= MAX_SEATS) return s;
      const bots = [...s.bots];
      bots[index] = isBot;
      return { bots };
    }),

  setDeck: (index, deckId) =>
    set((s) => {
      if (index < 0 || index >= MAX_SEATS) return s;
      const deckIds = [...s.deckIds];
      deckIds[index] = deckId;
      return { deckIds };
    }),

  // A deck deleted on the Decks screen while a seat still points at it would
  // silently fall back to a starter deck at start time — the seat says one thing
  // and the table shows another. Clearing it makes the change visible instead.
  dropMissingDecks: (existing) =>
    set((s) => {
      const alive = new Set(existing);
      if (s.deckIds.every((id) => id === null || alive.has(id))) return s;
      return { deckIds: s.deckIds.map((id) => (id !== null && alive.has(id) ? id : null)) };
    }),
}));
