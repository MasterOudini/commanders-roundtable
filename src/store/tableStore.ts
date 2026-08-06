import { create } from 'zustand';
import { useAim } from './aimStore';
import type { LegalAction } from '../engine/legal';
import type { CardData } from '../data/cardTypes';
// ⚠️ Pure option types only — the exception invariant 4 allows. This store never
// sees a `GameState`; it reads a `PlayerView` like every other client.
import type { Awaiting, DefenderRef, StopPolicy, TargetChoice } from '../engine/types/state';
import type { TargetSpec } from '../engine/types/oracle';

/**
 * What is being aimed. An ability adds which of its owner's abilities it is;
 * `stack` is an object ALREADY on the stack whose live `chooseTargets` prompt
 * is being answered (D169) — its specs come off the awaiting, never re-parsed.
 */
export type TargetSource =
  | { readonly kind: 'spell'; readonly card: string }
  | { readonly kind: 'ability'; readonly card: string; readonly abilityIndex: number }
  | { readonly kind: 'stack'; readonly card: string };

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
      /**
       * What the last commit does: a spell pays first, a free ability
       * submits, and `answer` sends a `ChooseTargets` for a prompt the
       * engine has ALREADY raised (D169) — the one case where backing out is
       * not local, so Escape re-arms rather than escaping.
       */
      readonly next: 'payment' | 'submit' | 'answer';
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
      /**
       * Which FACE is being cast — a split half, an adventure, a modal DFC's
       * back (D155). Omitted means face 0, which is every ordinary card.
       *
       * ⚠️ It has to ride the payment mode rather than be looked up again in
       * `PaymentReview`, because by then the only thing identifying the spell is
       * the card id — and a card with two castable faces has two costs. Getting
       * this wrong charges one half's mana for the other's, which is D53's
       * "approve one payment, be charged another" with the halves swapped.
       */
      readonly faceIndex?: number;
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
    }
  /**
   * Naming the permanent an ability's sacrifice cost eats (D168).
   *
   * ⚠️ TIER 1, unlike `attach` above: the pick rides the `ActivateAbility`
   * intent, the host re-validates it against `sacrificeCandidatesFor`, and the
   * charge is a real `CardsMoved` in the cost batch. The mode carries no
   * candidate list of its own — the veil re-reads them off the CURRENT legal
   * action every commit (`GameLayer`), so a candidate that died mid-pick stops
   * being offered rather than being refused after the click.
   */
  | {
      readonly kind: 'sacrifice';
      readonly card: string;
      readonly abilityIndex: number;
      /** Shown in the prompt: the ability's own label. */
      readonly name: string;
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
   * "Which mana?" — open on the source, or SOURCES, being tapped.
   *
   * ⚠️ A LIST, even for one card. A plain click on a land that can make two
   * things and a shift-click that adds a fourth land to a batch are the same
   * question asked about a different number of cards, and modelling the single
   * case separately is how two code paths end up disagreeing about what tapping
   * means.
   *
   * ⚠️ It holds the CARDS and where to draw, never the options. Those are read
   * out of `legal` every render, exactly as `CardMenu` re-reads the card: a
   * source that gets tapped, bounced or killed while the panel is open must stop
   * offering mana it can no longer make, and a snapshot taken at open time would
   * happily offer it.
   */
  manaChoice: { cards: readonly string[]; x: number; y: number } | null;
  /**
   * "Which half?" — a card in hand with more than one playable face (D155).
   *
   * ⚠️ Only the CARD is held, never the options: they are recomputed from
   * `legal` every render for `manaChoice`'s reason one line up. A modal DFC
   * whose land half stops being playable because somebody else's turn began
   * must stop offering it while the panel is open.
   */
  faceChoice: { card: string; x: number; y: number } | null;
  /**
   * Cards picked so far for whichever card-picking prompt is up — a hand
   * discard (D137), a library pick (D141), or an ORDERING (D142).
   *
   * ⚠️ **IT IS AN ORDER, NOT A SET, and D142 is why that matters.** For the two
   * picking prompts the sequence is incidental; for `orderCards` it IS the
   * answer, so this has always to be appended to rather than toggled into a set.
   * The array shape was right from D137 by luck; it is right on purpose now.
   *
   * ⚠️ UI STATE, and it has to be: the answer is SIMULTANEOUS (CR 701.8a
   * chooses N cards and discards them together), so the intent takes all of them
   * at once and something has to hold the partial pick until it is complete.
   * `MulliganBottom` sends one card per click instead and the engine
   * accumulates — a fine idiom there, and the wrong one here, because a discard
   * applied a card at a time is a different rule from a discard applied at once.
   *
   * ⚠️ Cleared whenever the prompt changes, not when it is answered: a
   * rewind, a resync or a spell fizzling all end the question, and a stale pick
   * would ring cards the next prompt never asked about.
   */
  pickOrder: readonly string[];
  /** The "what shall I do with this library" menu, anchored to a library pile. */
  libraryMenu: { player: string; x: number; y: number } | null;
  /**
   * Looking through an OPEN pile — a graveyard or an exile zone.
   *
   * ⚠️ Not anchored, unlike its three siblings: a graveyard holds thirty cards
   * and a panel beside the pile could not show them. It is centred, like the
   * peek panel, for the same reason.
   */
  zoneBrowser: { player: string; kind: 'gy' | 'exile' } | null;
  /**
   * What the cards I am currently looking at are FOR — **when I chose to look at
   * them myself.**
   *
   * ⚠️ UI state, and it has to be: the engine sees a reveal and nothing more. A
   * scry and a surveil are the same peek followed by different decisions, and
   * teaching the engine to tell them apart would be teaching it a rule it does
   * not enforce — the whole Tier-3 line. The panel remembers which question it
   * asked; the log records what was actually done.
   *
   * ⚠️⚠️ **IT IS A TIER-3 CONCEPT AND NOTHING ELSE, which is narrower than it
   * looks and was not written down until D147.** When the RULES are asking about
   * these cards — a `chooseFromZone` over a library (D141) or an `orderCards`
   * (D142) — the prompt owns the panel: it supplies the title, the hint and what
   * a click means, and every button this field selects between is gone. So this
   * value is not merely unused in that state, it is meaningless in it, and
   * anything reading it has to check for a prompt first. `PeekPanel` does;
   * `data-peek-mode` reports `prompt` rather than a stale mode, so the DOM says
   * which of the two is in charge instead of implying this one always is.
   */
  peekMode: 'look' | 'scry' | 'surveil';
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
  openManaChoice: (cards: readonly string[], x: number, y: number) => void;
  openFaceChoice: (card: string, x: number, y: number) => void;
  closeFaceChoice: () => void;
  /**
   * Shift-click: take one more of this slot into the batch, or clear it.
   *
   * ⚠️ It takes the SLOT'S CARDS, not one card, because a slot may be a pile:
   * twelve identical Forests are one thing you can point at (D19) and twelve
   * things you can tap. Passing a single card is the ordinary case and behaves
   * exactly as a toggle.
   */
  toggleManaChoice: (members: readonly string[], x: number, y: number) => void;
  closeManaChoice: () => void;
  togglePick: (card: string) => void;
  clearPick: () => void;
  openLibraryMenu: (player: string, x: number, y: number) => void;
  closeLibraryMenu: () => void;
  openZoneBrowser: (player: string, kind: 'gy' | 'exile') => void;
  closeZoneBrowser: () => void;
  setPeekMode: (mode: 'look' | 'scry' | 'surveil') => void;
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
  manaChoice: null,
  faceChoice: null,
  pickOrder: [],
  libraryMenu: null,
  zoneBrowser: null,
  peekMode: 'look',
  numberRequest: null,
  textRequest: null,

  setMode: (mode) => set({ mode }),
  setGameSetup: ({ tokens, stops }) => set({ tokens, stops }),
  /**
   * ⚠️ A PARTIAL DISCARD PICK DIES WITH THE PROMPT THAT ASKED FOR IT (D137).
   * The question can end without being answered — a rewind, a resync, the seat
   * changing under a hotseat hand-off — and a pick left behind would ring cards
   * for a prompt that is gone, or worse, be sent as the answer to the next one.
   * Keyed on the prompt CHANGING rather than on it clearing, so a second discard
   * arriving straight after the first also starts empty.
   */
  setSnapshot: (s) =>
    set((st) => (st.awaiting === s.awaiting ? s : { ...s, pickOrder: [] })),
  setMessage: (message) => set({ message }),
  setToolsOpen: (toolsOpen) => set({ toolsOpen }),
  setStopsOpen: (stopsOpen) => set({ stopsOpen }),
  setLogOpen: (logOpen) => set({ logOpen }),
  // ⚠️ The three anchored panels are MUTUALLY EXCLUSIVE. Each is pinned to a
  // card, so two open at once would overlap and the one underneath would take
  // clicks meant for the one on top.
  openCardMenu: (card, x, y) => set({ cardMenu: { card, x, y }, attachments: null, manaChoice: null }),
  closeCardMenu: () => set({ cardMenu: null }),
  openAttachments: (host, x, y) => set({ attachments: { host, x, y }, cardMenu: null, manaChoice: null }),
  closeAttachments: () => set({ attachments: null }),
  openManaChoice: (cards, x, y) => set({ manaChoice: { cards, x, y }, cardMenu: null, attachments: null }),
  openFaceChoice: (card, x, y) =>
    set({ faceChoice: { card, x, y }, cardMenu: null, attachments: null, manaChoice: null }),
  closeFaceChoice: () => set({ faceChoice: null }),
  toggleManaChoice: (members, x, y) => {
    const first = members[0];
    if (first === undefined) return;
    const open = get().manaChoice;
    if (!open) {
      set({ manaChoice: { cards: [first], x, y }, cardMenu: null, attachments: null });
      return;
    }
    // ⚠️ ONE MORE PER CLICK. Shift-clicking a pile of twelve Forests five times
    // means five Forests, not one Forest toggled five times — which is what a
    // slot-keyed toggle gave, because every click named the same representative.
    const next = members.find((id) => !open.cards.includes(id));
    const cards = next !== undefined
      ? [...open.cards, next]
      // ⚠️ Once the whole slot is in, the click CLEARS the whole slot. For the
      // ordinary one-card slot that is exactly the toggle it always was, and for
      // a pile it is the only reading of "I have clicked this as many times as
      // it has cards" that leaves the player somewhere useful. Escape still
      // drops one at a time, which is the fine-grained undo.
      : open.cards.filter((id) => !members.includes(id));
    // ⚠️ Taking the last one back out CLOSES it. A panel listing nothing, still
    // anchored to a card, is a dialog about no question.
    set({ manaChoice: cards.length === 0 ? null : { ...open, cards } });
  },
  closeManaChoice: () => set({ manaChoice: null }),
  togglePick: (card) =>
    set((st) => ({
      pickOrder: st.pickOrder.includes(card)
        ? st.pickOrder.filter((c) => c !== card)
        : [...st.pickOrder, card],
    })),
  clearPick: () => set({ pickOrder: [] }),
  openLibraryMenu: (player, x, y) =>
    set({ libraryMenu: { player, x, y }, cardMenu: null, attachments: null, manaChoice: null }),
  closeLibraryMenu: () => set({ libraryMenu: null }),
  openZoneBrowser: (player, kind) =>
    set({ zoneBrowser: { player, kind }, cardMenu: null, attachments: null, manaChoice: null, libraryMenu: null }),
  closeZoneBrowser: () => set({ zoneBrowser: null }),
  setPeekMode: (peekMode) => set({ peekMode }),
  askNumber: (numberRequest) => set({ numberRequest }),
  askText: (textRequest) => set({ textRequest }),
  closeDialogs: () => set({ numberRequest: null, textRequest: null }),

  escape: () => {
    const state = get();
    if (state.numberRequest || state.textRequest) {
      set({ numberRequest: null, textRequest: null });
      return;
    }
    // ⚠️ A BATCH of mana sources backs out one at a time, for the reason the
    // attacker list does: a player who shift-clicked five lands and taps Escape
    // to shed the last one must not lose the other four.
    if (state.manaChoice && state.manaChoice.cards.length > 1) {
      set({ manaChoice: { ...state.manaChoice, cards: state.manaChoice.cards.slice(0, -1) } });
      return;
    }
    if (state.zoneBrowser) {
      set({ zoneBrowser: null });
      return;
    }
    if (state.cardMenu || state.attachments || state.manaChoice || state.libraryMenu) {
      set({ cardMenu: null, attachments: null, manaChoice: null, libraryMenu: null });
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
    // to drop the aim with it — the same reason the pending blocker does. The
    // sacrifice pick pins its tail to the ability's source (D168), so it backs
    // out the same way.
    if (mode.kind === 'attach' || mode.kind === 'sacrifice') {
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
