// D332 - THE MONARCH (CR 724): a card crowns its controller; the monarch draws
// a card at the beginning of their end step; a creature dealing combat damage
// to the monarch makes its controller the monarch.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import { FEAST_OF_SUCCESSION, JARED_CARTHALION_TRUE_HEIR } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { THORN_OF_THE_BLACK_ROSE_SCRIPT } from './scripts/cards/thornOfTheBlackRose';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Thorn of the Black Rose enters for p1 on p1's third-turn main phase: "When this creature enters, you become the monarch." */
function crowned(): { g: Game; self: InstanceId; no: InstanceId; hand0: number; life0: number; lib0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Thorn of the Black Rose'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([THORN_OF_THE_BLACK_ROSE_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', 'Thorn of the Black Rose', 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  expect(g.state.monarch).toBeNull();
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  expect(g.state.monarch).toBe('p1');
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  // D442 - the draw is counted off the LIBRARY: the hand is discarded to seven at cleanup (CR 514.1).
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, no, hand0, life0, lib0 };
}

describe('D332 - the monarch', () => {
  test('the monarch draws a card at the beginning of their end step (CR 724.3)', () => {
    const { g, lib0 } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    // p1's end-step draw, and nothing else (p2's draw step is p2's).
    expect((g.state.zones.library.p1 ?? []).length).toBe(lib0 - 1);
    expect(g.state.monarch).toBe('p1');
  });

  test("the opponent's creature dealing combat damage to the monarch takes the crown (CR 724.5)", () => {
    const { g, no, life0 } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers' || s.turn.phase === 'postcombatMain', 40_000);
    if (g.state.priority.awaiting?.kind === 'declareBlockers') {
      must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 40_000);
    expect(g.state.players.p1?.life).toBeLessThan(life0);
    expect(g.state.monarch).toBe('p2');
  });

  test('the new monarch draws at their own end step, the old one does not', () => {
    const { g, no } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers' || s.turn.phase === 'postcombatMain', 40_000);
    if (g.state.priority.awaiting?.kind === 'declareBlockers') {
      must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 40_000);
    const p1 = (g.state.zones.library.p1 ?? []).length;
    const p2 = (g.state.zones.library.p2 ?? []).length;
    advanceUntil(g, (s) => s.turn.turnNumber === 5, 40_000);
    // p2's end step: p2 draws as the monarch; at the top of turn 5 (before p1's
    // own draw step) p1's hand is exactly what it was - the old monarch drew nothing.
    expect((g.state.zones.library.p2 ?? []).length).toBe(p2 - 1);
    expect((g.state.zones.library.p1 ?? []).length).toBe(p1);
  });
});

// D522 - THE MONARCH PAYLOAD (CR 724.2): `You become the monarch.` and `Target opponent | player becomes the monarch.`
// as a vocabulary kind over the subsystem above. No new state - the crown, the end-step draw and the combat steal are
// D332's; this is the sentence that hands it over, so a card that crowns somebody stops needing its own script (32
// leftover rows print it). What is proven here: the readings (both forms, the `Then` form, a spell's whole text; the
// turn restriction beside it stays unread); Feast of Succession crowning its caster through the vocabulary, with the
// end-step draw following; a player who already wears it becoming nothing (no event, said); the crown taken from
// another player; the aimed form through the Tier-3 offer (Jared Carthalion's assisted line, aimed at an opponent);
// the replay hash on each.
describe('D522 - the monarch payload', () => {
  const kinds = (text: string) => {
    const p = parseEffects(text, '~', true);
    return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, self: e.self })) };
  };
  const crownings = (g: Game) => g.log.filter((e) => e.body.t === 'MonarchChanged').length;
  const said = (g: Game, re: RegExp) => g.log.some((e) => e.body.t === 'Narrated' && re.test(e.body.text));
  const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => {
    for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 }));
  };
  const main3 = (g: Game) =>
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
  /** A two-seat game holding Feast of Succession, p2 with a Bears on the board. */
  const feastGame = (copies = 1) => {
    const g = startedGame({ players: 2, decks: [Array.from({ length: copies }, () => 'Feast of Succession'), ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    main3(g);
    return { g, bears };
  };
  const castFeast = (g: Game): InstanceId => {
    const card = put(g, 'p1', 'Feast of Succession', 'hand');
    mana(g, 'p1', 'BBBBBB');
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [] }));
    settle(g);
    return card;
  };

  test('the readings: both forms and the Then form; the turn restriction beside it stays unread', () => {
    expect(kinds('You become the monarch.')).toEqual({ mode: 'auto', effects: [{ kind: 'becomeMonarch', self: true }] });
    expect(kinds('Target opponent becomes the monarch.')).toEqual({ mode: 'auto', effects: [{ kind: 'becomeMonarch', self: false }] });
    expect(kinds('Target player becomes the monarch.')).toEqual({ mode: 'auto', effects: [{ kind: 'becomeMonarch', self: false }] });
    expect(kinds('Draw a card. Then you become the monarch.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'draw' }, { kind: 'becomeMonarch', self: true }] });
    expect(kinds(FEAST_OF_SUCCESSION.faces[0]?.oracleText ?? '')).toMatchObject({ mode: 'auto', effects: [{ kind: 'massPump' }, { kind: 'becomeMonarch', self: true }] });
    // Jared Carthalion: the crown is read, the turn restriction is not (a restriction is no clause of this kind).
    expect(kinds("Target opponent becomes the monarch. You can't become the monarch this turn.").mode).not.toBe('auto');
  });

  test('Feast of Succession crowns its caster through the vocabulary, and the crown draws at the end step; the replay hash', () => {
    const { g, bears } = feastGame();
    expect(g.state.monarch).toBeNull();
    const spell = castFeast(g);
    expect(g.state.monarch, 'the caster wears it').toBe('p1');
    expect(crownings(g)).toBe(1);
    expect(g.state.cards[bears]?.zone.kind, 'the -4/-4 killed the Bears').toBe('graveyard');
    expect(said(g, /becomes the monarch/), 'said').toBe(true);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    // D332's own rule, over the crown this decision handed out: the monarch draws at the beginning of their end step.
    const lib0 = (g.state.zones.library.p1 ?? []).length;
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect((g.state.zones.library.p1 ?? []).length).toBe(lib0 - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a player who already wears the crown becomes nothing: no second event, said; the replay hash', () => {
    const { g } = feastGame(2);
    castFeast(g);
    expect(g.state.monarch).toBe('p1');
    expect(crownings(g)).toBe(1);
    castFeast(g);
    expect(g.state.monarch).toBe('p1');
    expect(crownings(g), 'the crown did not move, so nothing happened').toBe(1);
    expect(said(g, /is the monarch already/), 'said').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the crown is taken from the player who wore it; the replay hash', () => {
    const { g } = feastGame();
    g.emit([{ t: 'MonarchChanged', player: 'p2' }]);
    expect(g.state.monarch).toBe('p2');
    castFeast(g);
    expect(g.state.monarch, 'the previous monarch lost it (CR 724.2)').toBe('p1');
    expect(crownings(g)).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("the aimed form crowns the player the clause names, not the caster; the replay hash", () => {
    // The aimed branch has no printed SPELL in the format (every card that aims the crown is a permanent), so it is
    // proven the way D332 proved the crown itself: one script over a real fixture, resolving the vocabulary with the
    // player the clause named (the generated rows of this wave do the same through their own targets).
    const AIMED = vocabularyEffects("Target opponent becomes the monarch.", JARED_CARTHALION_TRUE_HEIR.name);
    const AIMED_T = vocabularyTargets("Target opponent becomes the monarch.");
    const script: CardScript = {
      oracleId: JARED_CARTHALION_TRUE_HEIR.oracleId,
      name: JARED_CARTHALION_TRUE_HEIR.name,
      triggers: [
        {
          abilityId: "etb-1",
          text: "When Jared Carthalion enters, target opponent becomes the monarch.",
          event: "CardsMoved",
          activeZones: ["battlefield"],
          optional: false,
          matches: (_ctx, self, ev) => ev.t === "CardsMoved" && ev.moves.some((m) => m.card === self && m.to.kind === "battlefield" && m.from.kind !== "battlefield"),
          label: () => "Jared Carthalion - target opponent becomes the monarch",
          resolve: (ctx, _self, obj) => ctx.vocabulary({ ...obj, targets: [{ kind: "player", id: "p2" }] }, AIMED, AIMED_T),
        },
      ],
    };
    const g = startedGame({ players: 2, decks: [["Jared Carthalion, True Heir"], ["Grizzly Bears"]], scripts: createRegistry([script]) });
    holdEverywhere(g);
    main3(g);
    expect(g.state.monarch).toBeNull();
    put(g, "p1", "Jared Carthalion, True Heir", "battlefield");
    settle(g);
    expect(g.state.monarch, "the opponent the clause named, not the caster").toBe("p2");
    expect(crownings(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
