// D523 - THE GATED CLAUSE. `<clause>. If <condition>, <clause>.` / `Then if <condition>, <clause>.` / `If <condition>,
// <clause> instead.` - a sentence whose second reading is gated on the board. D423 built exactly this for ONE condition
// (`If this spell was kicked`); the gate is the engine's own `ActivationCondition` union now, the closed set `Activate
// only if ...` already reads and `activationConditionsHold` already evaluates, asked at RESOLUTION over the board the
// clauses before it left (CR 608.2). What is proven here: the readings (the three forms, the referent inner clause, a
// condition outside the union leaving the card assisted); Resourceful Return's plain gate with the artifact and
// without; For the Family's `instead` gate replacing its base with four creatures and standing aside with three; the
// narration on the unmet branch; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => {
  const p = parseEffects(text, '~', true);
  return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, gate: e.gate?.map((g) => g.kind) ?? null, instead: e.gateInstead ?? false })) };
};
const said = (g: Game, re: RegExp) => g.log.some((e) => e.body.t === 'Narrated' && re.test(e.body.text));
const power = (g: Game, id: InstanceId) => {
  const mod = g.state.untilEndOfTurn.filter((m) => m.card === id).reduce((n, m) => n + (m.power ?? 0), 0);
  return mod;
};

describe('D523 - the gated clause', () => {
  test('the readings: the plain, the Then and the instead forms; a condition outside the union leaves the card assisted', () => {
    expect(kinds('Return target creature card from your graveyard to your hand. If you control an artifact, draw a card.')).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'returnFromGraveyard', gate: null }, { kind: 'draw', gate: ['board'], instead: false }],
    });
    expect(kinds('Draw a card. Then if you control three or more creatures, you gain 2 life.')).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'draw' }, { kind: 'gainLife', gate: ['controlCount'], instead: false }],
    });
    expect(kinds('Target creature gets +2/+2 until end of turn. If you control four or more creatures, that creature gets +4/+4 until end of turn instead.')).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'pump', gate: null }, { kind: 'pump', gate: ['controlCount'], instead: true }],
    });
    expect(kinds("Create a 1/1 white Spirit creature token with flying. If you're the monarch, create a 4/4 white Angel creature token with flying instead.")).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'createToken' }, { kind: 'createToken', gate: ['monarch'], instead: true }],
    });
    // A condition the closed union does not read leaves the whole card to the player (D90).
    expect(kinds('Draw a card. If the moon is full, you gain 2 life.').mode).not.toBe('auto');
  });

  test('Resourceful Return with no artifact: the gate does nothing and says so; with one: the card is drawn; the replay hash', () => {
    const dead = (g: Game) => put(g, 'p1', 'Grizzly Bears', 'graveyard');
    // Unmet: the return happens, the draw does not.
    {
      const g = startedGame({ players: 2, decks: [['Resourceful Return', 'Grizzly Bears'], ['Grizzly Bears']] });
      holdEverywhere(g);
      const bears = dead(g);
      main(g, 3);
      const card = put(g, 'p1', 'Resourceful Return', 'hand');
      const hand0 = (g.state.zones.hand.p1 ?? []).length;
      mana(g, 'BB');
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
      settle(g);
      expect(g.state.cards[bears]?.zone.kind, 'the creature card came back').toBe('hand');
      // The spell left the hand, the Bears joined it: no card drawn on top of that.
      expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 - 1 + 1);
      expect(said(g, /does nothing: if the printed board condition holds/), 'the unmet gate is said').toBe(true);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
    // Met: an artifact on the board, so the draw happens too.
    {
      const g = startedGame({ players: 2, decks: [['Resourceful Return', 'Grizzly Bears', 'Sol Ring'], ['Grizzly Bears']] });
      holdEverywhere(g);
      const bears = dead(g);
      put(g, 'p1', 'Sol Ring', 'battlefield');
      main(g, 3);
      const card = put(g, 'p1', 'Resourceful Return', 'hand');
      const hand0 = (g.state.zones.hand.p1 ?? []).length;
      mana(g, 'BB');
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
      settle(g);
      expect(g.state.cards[bears]?.zone.kind).toBe('hand');
      expect((g.state.zones.hand.p1 ?? []).length, 'the spell out, the Bears back, one drawn').toBe(hand0 - 1 + 1 + 1);
      expect(said(g, /does nothing: if the printed board condition holds/)).toBe(false);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });

  test('For the Family: three creatures get the base +2/+2, four get +4/+4 instead; the replay hash', () => {
    const cast = (creatures: number) => {
      const g = startedGame({ players: 2, decks: [['For the Family', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']] });
      holdEverywhere(g);
      const mine: InstanceId[] = [];
      for (let i = 0; i < creatures; i++) mine.push(put(g, 'p1', 'Grizzly Bears', 'battlefield'));
      main(g, 3);
      const card = put(g, 'p1', 'For the Family', 'hand');
      mana(g, 'G');
      const target = mine[0] as InstanceId;
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: target }] }));
      settle(g);
      return { g, target };
    };
    // Three creatures: the gate is unmet, the base pump stands, and the log says the bigger one did nothing.
    {
      const { g, target } = cast(3);
      expect(power(g, target), '+2/+2').toBe(2);
      expect(said(g, /does nothing: if you control 4 or more/), 'the unmet gate is said').toBe(true);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
    // Four: the gate holds, so the base is REPLACED - +4/+4 and not +6/+6.
    {
      const { g, target } = cast(4);
      expect(power(g, target), 'the base was replaced, not added to').toBe(4);
      expect(said(g, /is replaced/), 'the replacement is said').toBe(true);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });
});
