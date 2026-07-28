import { create } from 'zustand';
import { useAim } from './aimStore';
import type { LegalAction } from '../engine/legal';
import type { CardData } from '../data/cardTypes';
// ⚠️ Pure option types only — the exception invariant 4 allows. This store never
// sees a `GameState`; it reads a `PlayerView` like every other client.
import type { Awaiting, DefenderRef, StopPolicy, TargetChoice } from '../engine/types/state';
import type { TargetSpec } from '../engine/types/oracle';

/** What is being aimed. An ability adds which of its owner's abilities it is. */
export type TargetSource =
  | { readonly kind: 'spell'; readonly card: string }
  | { readonly kind: 'ability'; readonly card: string; readonly abilityIndex: number };

// UI state for the play surface: what the game is waiting for, what the player
// is halfway through choosing, and which drawers are open.
//
// ⚠️ This store holds INTENTIONS, never truth. Card→zone, life, priority and
// legality all live in the projected `PlayerView` and the engine. If a value
// here disagreed with the view, the view wins — which is why nothing here is
// ever read to decide whether an action is legal.

export type TableMode =
  | { readonly kind: 'idle' }
  /**
   * Aiming a spell or an ability: the veil is up, the arrow follows the cursor,
   * and only legal targets are clickable.
   *
   * ⚠️ `chosen` is TYPED, so it feeds `CastSpell.targets` with no translation
   * table in between. It used to be `string[]`, which made "is this id a player
   * or a card?" a guess the UI had to re-make at every use.
   *
   * ⚠️ Targets are chosen BEFORE the intent is sent (CR 601.2c precedes 601.2f),
   * which is what makes backing out purely local: there is no `pendingCast` in
   * game state yet, so Escape sends nothing and there is no half-cast to unwind.
   */
  | {
      readonly kind: 'targeting';
      readonly source: TargetSource;
      readonly name: string;
      readonly chosen: readonly TargetChoice[];
      readonly specs: readonly TargetSpec[];
      readonly min: number;
      readonly max: number;
      /** What the last commit does: a spell pays first, a free ability submits. */
      readonly next: 'payment' | 'submit';
    }
  /**
   * Reviewing what auto-tap proposes before paying.
   *
   * ⚠️ `targets` is carried through from the targeting stage so `previewCast`
   * can price the WARD surcharge. Without it the player would approve one total
   * and be charged another the moment they were pointing at a warded permanent —
   * the exact failure D53 exists to prevent.
   */
  | {
      readonly kind: 'payment';
      readonly card: string;
      readonly xValue: number;
      readonly targets: readonly TargetChoice[];
    }
  /**
   * Choosing attackers, before submitting them as one declaration.
   *
   * ⚠️ Each attacker carries ITS OWN defender. The UI used to send one
   * hardcoded `seats.find((s) => s.id !== viewer)` for every attacker, so at a
   * 3–4 player table you could not choose whom you were attacking at all — while
   * the engine had accepted a per-attacker `DefenderRef` since M3.
   */
  | {
      readonly kind: 'attackers';
      readonly chosen: readonly { readonly card: string; readonly defender: DefenderRef }[];
      /** Who a newly-armed attacker goes at. The player on my left, by default. */
      readonly defaultDefender: DefenderRef | null;
    }
  /** Choosing blocks: pick a blocker, then the attacker it blocks. */
  | {
      readonly kind: 'blockers';
      readonly blocks: readonly { readonly blocker: string; readonly attacker: string }[];
      readonly pendingBlocker: string | null;
    }
  /**
   * Pointing an Equipment or an Aura at what it should be attached to.
   *
   * ⚠️ TIER 3, and it must keep saying so. `Equip {2}` has no colon, so the
   * ingest never reads it as an activated ability and the engine cannot charge
   * it (see the note at the top of `activatedParse.ts`). This mode moves the
   * attachment and nothing else: paying the equip cost, and equipping only at
   * sorcery speed, stay the player's job exactly as the card's Tier-3 line says.
   * Offering it as "Equip" would claim an enforcement that does not exist.
   */
  | {
      readonly kind: 'attach';
      readonly card: string;
      /** Shown in the prompt: what the player picked up. */
      readonly name: string;
      /** Equipment goes on creatures; an Aura may go on anything it enchants. */
      readonly creaturesOnly: boolean;
    };

export interface NumberRequest {
  readonly title: string;
  readonly label: string;
  readonly initial: number;
  readonly min: number;
  readonly max: number;
  readonly onSubmit: (value: number) => void;
}

export interface TextRequest {
  readonly title: string;
  readonly label: string;
  readonly initial: string;
  readonly onSubmit: (value: string) => void;
}

interface TableUi {
  mode: TableMode;
  awaiting: Awaiting | null;
  legal: LegalAction[];
  viewer: string;
  seats: { id: string; name: string }[];
  running: boolean;
  finished: boolean;
  winners: string[];
  /**
   * What a started game handed the table: the token printings the Tier-3 tools
   * offer, and the stop policy the panel opens on.
   *
   * ⚠️ Set by whoever STARTS the game, not by the table. The table used to own
   * these in component state, which meant only a game started from the table
   * itself ever had tokens to create.
   */
  tokens: readonly CardData[];
  stops: StopPolicy | null;
  /** Last rejection, shown inline and cleared by the next successful intent. */
  message: string | null;
  toolsOpen: boolean;
  stopsOpen: boolean;
  logOpen: boolean;
  /** Menu anchored to a card, or null. */
  cardMenu: { card: string; x: number; y: number } | null;
  /**
   * The "what is on this creature" panel, anchored to the host it was opened
   * from. An attachment renders tucked behind its host, which is the right
   * picture and a terrible affordance: 13 px of card edge carrying no name and
   * no way to act on it.
   */
  attachments: { host: string; x: number; y: number } | null;
  /**
   * ⚠️ `window.prompt` THROWS in Electron. Every number and text input in this
   * app goes through these two slots and a real dialog component; a probe greps
   * `src/` for `window.prompt|confirm|alert` and must find nothing.
   */
  numberRequest: NumberRequest | null;
  textRequest: TextRequest | null;

  setMode: (mode: TableMode) => void;
  /** A game just started: what it gave the table. Ending one clears it. */
  setGameSetup: (setup: { tokens: readonly CardData[]; stops: StopPolicy | null }) => void;
  setSnapshot: (s: {
    awaiting: Awaiting | null;
    legal: LegalAction[];
    viewer: string;
    seats: { id: string; name: string }[];
    running: boolean;
    finished: boolean;
    winners: string[];
  }) => void;
  setMessage: (message: string | null) => void;
  setToolsOpen: (open: boolean) => void;
  setStopsOpen: (open: boolean) => void;
  setLogOpen: (open: boolean) => void;
  openCardMenu: (card: string, x: number, y: number) => void;
  closeCardMenu: () => void;
  openAttachments: (host: string, x: number, y: number) => void;
  closeAttachments: () => void;
  askNumber: (request: NumberRequest) => void;
  askText: (request: TextRequest) => void;
  closeDialogs: () => void;
  /** Escape backs out ONE step rather than dumping everything. */
  escape: () => void;
}

export const useTable = create<TableUi>((set, get) => ({
  mode: { kind: 'idle' },
  awaiting: null,
  legal: [],
  viewer: 'p1',
  seats: [],
  running: false,
  finished: false,
  winners: [],
  tokens: [],
  stops: null,
  message: null,
  toolsOpen: false,
  stopsOpen: false,
  logOpen: false,
  cardMenu: null,
  attachments: null,
  numberRequest: null,
  textRequest: null,

  setMode: (mode) => set({ mode }),
  setGameSetup: ({ tokens, stops }) => set({ tokens, stops }),
  setSnapshot: (s) => set(s),
  setMessage: (message) => set({ message }),
  setToolsOpen: (toolsOpen) => set({ toolsOpen }),
  setStopsOpen: (stopsOpen) => set({ stopsOpen }),
  setLogOpen: (logOpen) => set({ logOpen }),
  openCardMenu: (card, x, y) => set({ cardMenu: { card, x, y }, attachments: null }),
  closeCardMenu: () => set({ cardMenu: null }),
  openAttachments: (host, x, y) => set({ attachments: { host, x, y }, cardMenu: null }),
  closeAttachments: () => set({ attachments: null }),
  askNumber: (numberRequest) => set({ numberRequest }),
  askText: (textRequest) => set({ textRequest }),
  closeDialogs: () => set({ numberRequest: null, textRequest: null }),

  escape: () => {
    const state = get();
    if (state.numberRequest || state.textRequest) {
      set({ numberRequest: null, textRequest: null });
      return;
    }
    if (state.cardMenu || state.attachments) {
      set({ cardMenu: null, attachments: null });
      return;
    }
    const mode = state.mode;
    // ⚠️ One step at a time. A player halfway through declaring five attackers
    // who taps Escape to close a menu should not lose the five.
    if (mode.kind === 'targeting' && mode.chosen.length > 0) {
      set({ mode: { ...mode, chosen: mode.chosen.slice(0, -1) } });
      return;
    }
    if (mode.kind === 'blockers' && mode.pendingBlocker) {
      // ⚠️ The arrow's tail is pinned to the pending blocker, so dropping the
      // blocker has to drop the aim with it — otherwise an arrow stays glued to
      // the cursor with nothing at the other end of it.
      useAim.getState().reset();
      set({ mode: { ...mode, pendingBlocker: null } });
      return;
    }
    if (mode.kind === 'blockers' && mode.blocks.length > 0) {
      set({ mode: { ...mode, blocks: mode.blocks.slice(0, -1) } });
      return;
    }
    if (mode.kind === 'attackers' && mode.chosen.length > 0) {
      set({ mode: { ...mode, chosen: mode.chosen.slice(0, -1) } });
      return;
    }
    // ⚠️ The arrow's tail is pinned to the attachment, so dropping the mode has
    // to drop the aim with it — the same reason the pending blocker does.
    if (mode.kind === 'attach') {
      useAim.getState().reset();
      set({ mode: { kind: 'idle' } });
      return;
    }
    if (mode.kind !== 'idle') {
      set({ mode: { kind: 'idle' } });
      return;
    }
    if (state.toolsOpen) set({ toolsOpen: false });
    else if (state.stopsOpen) set({ stopsOpen: false });
  },
}));
