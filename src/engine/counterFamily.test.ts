// D422 - THE COUNTERSPELL FAMILY, proven at the parser and the stack.
//
// `This spell can't be countered.` on a SPELL face (`OracleFace.cantBeCountered` - the funnel drops the
// counter, the spell resolves), the countered-this-way destination (`counterTo`: Remand's hand, Dissipate's
// exile, Memory Lapse's library top), and the `{X}` price (Syncopate: the caster's announced X is what the
// spell's controller is asked to pay).
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number, player: 'p1' | 'p2' = 'p1') =>
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: sym, amount: n }));
const zone = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
/** p1's third-turn main phase, every seat under full control; p2 holds the given cards in its deck. */
function armed(p1: readonly string[], p2: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...p1], [...p2]], scripts: createRegistry([...SHIPPED_SCRIPTS]) });
  holdEverywhere(g);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
  return g;
}
/** p1 casts `name` (a creature spell, {G}{G} paid by hand) and passes; the spell sits on the stack for p2. */
function p1Casts(g: Game, name: string): { spell: InstanceId; top: string } {
  const spell = put(g, 'p1', name, 'hand');
  mana(g, 'G', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  must(g.submit({ t: 'PassPriority', player: 'p1' }));
  const top = g.state.stack[g.state.stack.length - 1]?.id as string;
  return { spell, top };
}

describe('D422 - the parser', () => {
  test('the uncounterable line is no clause; the destination rides the counter; a {X} price reads', () => {
    const a = parseEffects("This spell can't be countered.\nDestroy target nonland permanent with mana value 3 or less.", 'Abrupt Decay', true);
    expect(a.mode).toBe('auto');
    expect(a.effects.map((e) => e.kind)).toEqual(['destroy']);
    const r = parseEffects("Counter target spell. If that spell is countered this way, put it into its owner's hand instead of into that player's graveyard.\nDraw a card.", 'Remand', true);
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.counterTo])).toEqual([['counter', 'hand'], ['draw', null]]);
    expect(parseEffects("Counter target spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.", 'Dissipate', true).effects[0]?.counterTo).toBe('exile');
    expect(parseEffects("Counter target spell. If that spell is countered this way, put it on top of its owner's library instead of into that player's graveyard.", 'Memory Lapse', true).effects[0]?.counterTo).toBe('libraryTop');
    expect(parseEffects("Counter target spell. If that spell is countered this way, put it on the bottom of its owner's library instead of into that player's graveyard.", 'Spell Crumple', true).effects[0]?.counterTo).toBe('libraryBottom');
    const s = parseEffects("Counter target spell unless its controller pays {X}. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.", 'Syncopate', true);
    expect(s.mode).toBe('auto');
    expect(s.effects[0]?.kind).toBe('payOptional');
    expect(s.effects[0]?.pay?.cost?.xCount).toBe(1);
    expect(s.effects[0]?.pay?.ifNotPaid[0]?.counterTo).toBe('exile');
    // A first sentence that is not a counter refuses the span; the plain counter carries no destination.
    expect(parseEffects("Draw a card. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.", 'Probe', true).mode).not.toBe('auto');
    expect(parseEffects('Counter target spell.', 'Probe', true).effects[0]?.counterTo).toBeNull();
  });
});

describe('D422 - the uncounterable spell', () => {
  test('Counterspell aimed at Abrupt Decay resolves, counters nothing, says so; the Decay resolves and kills', () => {
    const g = armed(['Abrupt Decay'], ['Counterspell', BEARS]);
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    const decay = put(g, 'p1', 'Abrupt Decay', 'hand');
    mana(g, 'B', 1); mana(g, 'G', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: decay, targets: [{ kind: 'card', id: theirs }] }));
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    const top = g.state.stack[g.state.stack.length - 1]?.id as string;
    const counter = put(g, 'p2', 'Counterspell', 'hand');
    mana(g, 'U', 2, 'p2');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: top }] }));
    settle(g);
    expect(g.log.slice(n0).some((e) => e.body.t === 'Narrated' && /can't be countered/.test(e.body.text))).toBe(true);
    expect(g.log.slice(n0).some((e) => e.body.t === 'SpellCountered')).toBe(false);
    expect(zone(g, decay), 'resolved, in the graveyard').toBe('graveyard');
    expect(zone(g, theirs), 'the Decay destroyed the Bears (mana value 2)').toBe('graveyard');
    expect(zone(g, counter)).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D422 - the countered-this-way destination', () => {
  test('Remand puts the countered spell in its owner`s hand and draws; Dissipate exiles; Memory Lapse puts it on top', () => {
    for (const [name, cost, expected] of [['Remand', ['U', 1, 'C', 1], 'hand'], ['Dissipate', ['U', 2, 'C', 1], 'exile'], ['Memory Lapse', ['U', 1, 'C', 1], 'library']] as const) {
      const g = armed([BEARS, BEARS], [name, CYCLOPS]);
      const { spell, top } = p1Casts(g, BEARS);
      const counter = put(g, 'p2', name, 'hand');
      mana(g, cost[0] as 'U', cost[1] as number, 'p2'); mana(g, cost[2] as 'C', cost[3] as number, 'p2');
      const hand0 = (g.state.zones.hand.p2 ?? []).length;
      must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: top }] }));
      settle(g);
      expect(zone(g, spell), name).toBe(expected);
      expect(g.log.some((e) => e.body.t === 'SpellCountered'), name).toBe(true);
      if (name === 'Remand') expect((g.state.zones.hand.p2 ?? []).length, 'Remand draws').toBe(hand0 - 1 + 1);
      if (name === 'Memory Lapse') { const lib = g.state.zones.library.p1 ?? []; expect(lib[lib.length - 1], 'on top of its owner`s library').toBe(spell); }
      expect(stateHash(replay(g.log, g.seed)), name).toBe(g.hash());
    }
  });
});

describe('D422 - the {X} price', () => {
  test('Syncopate for X=2 asks the caster for {2}; declined, the spell is countered into exile; paid, it resolves', () => {
    for (const pays of [false, true]) {
      const g = armed([BEARS, 'Forest', 'Forest'], ['Syncopate', CYCLOPS]);
      const f1 = put(g, 'p1', 'Forest'); const f2 = put(g, 'p1', 'Forest');
      settle(g);
      const { spell, top } = p1Casts(g, BEARS);
      const sync = put(g, 'p2', 'Syncopate', 'hand');
      mana(g, 'U', 1, 'p2'); mana(g, 'C', 2, 'p2');
      must(g.submit({ t: 'CastSpell', player: 'p2', card: sync, targets: [{ kind: 'stack', id: top }], xValue: 2 }));
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
      const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' ? ask.player : null, 'the spell`s controller is asked').toBe('p1');
      expect(ask?.kind === 'payMana' ? ask.cost?.generic : null, 'X is the announced two').toBe(2);
      expect(ask?.kind === 'payMana' ? ask.cost?.xCount : null).toBe(0);
      must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: pays }));
      settle(g);
      if (pays) {
        expect(zone(g, spell), 'paid: the Bears resolved').toBe('battlefield');
        expect(g.state.cards[f1]?.tapped && g.state.cards[f2]?.tapped, 'paid with the two Forests').toBe(true);
      } else {
        expect(zone(g, spell), 'declined: countered into exile').toBe('exile');
        expect(g.state.cards[f1]?.tapped || g.state.cards[f2]?.tapped, 'nothing spent').toBe(false);
      }
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });
});
