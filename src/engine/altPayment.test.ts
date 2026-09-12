// D405 - CONVOKE (CR 702.51), IMPROVISE (CR 702.126), DELVE (CR 702.66): the cast names the
// creatures it taps, the artifacts it taps and the graveyard cards it exiles, each paying one
// symbol of the cost - a creature a coloured one of its colour while one is unpaid, else generic;
// the rest generic. The host validates every name, refuses one that would pay for nothing, taps
// and exiles ahead of the mana, and the mana plan never taps a permanent the cast already taps.
// The keyword line is claimed in the coverage, dropped from a spell's clauses (Stoke the Flames
// reads whole), and the classifier reads it as the engine's own.

import { describe, expect, test } from 'vitest';
import { parseAltCosts } from '../data/oracleParse';
import { primitiveFor } from '../data/primitives';
import { engineCompleteness } from '../data/engineComplete';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import { assignAlternativePayment, applyAlternativePayment, chooseAlternatives } from './altPayment';
import { buildPaymentProblem } from './mana';
import { parseManaCost } from '../data/oracleParse';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number, player: 'p1' | 'p2' = 'p1') =>
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: sym, amount: n }));
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: createRegistry([...SHIPPED_SCRIPTS]) });
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}

describe('convoke, improvise and delve (D405)', () => {
  test('the face reads the keyword line, the accounting claims it, the spell parser drops it, the classifier owns it', () => {
    expect(parseAltCosts('Convoke (Your creatures can help cast this spell.)\nCreatures you control get +3/+3 until end of turn.')).toEqual({ convoke: true, improvise: false, delve: false });
    expect(parseAltCosts('Convoke, delve\nTrample')).toEqual({ convoke: true, improvise: false, delve: true });
    expect(parseAltCosts('Improvise')).toEqual({ convoke: false, improvise: true, delve: false });
    expect(parseAltCosts('Flying, convoke')).toEqual({ convoke: false, improvise: false, delve: false });
    const stoke = ORACLE.byName('Stoke the Flames');
    expect(stoke?.faces[0]?.convoke).toBe(true);
    expect(stoke ? engineCompleteness(stoke.data) : null, 'Stoke the Flames reads whole: the keyword claimed, the damage a clause').toEqual({ complete: true, leftover: [] });
    expect(ORACLE.byName('Hooting Mandrills')?.faces[0]?.delve).toBe(true);
    expect(ORACLE.byName('Bastion Inventor')?.faces[0]?.improvise).toBe(true);
    const of = (text: string) => primitiveFor({ text, kind: 'sentence', raw: text }, 'Test Card');
    expect(of('Convoke')).toBe('scriptable');
    expect(of('Delve')).toBe('scriptable');
    expect(of('Convoke, delve')).toBe('scriptable');
    // The shared assignment: a green creature pays {G}, a red one generic, a third pays for nothing.
    const cost = parseManaCost('{2}{G}');
    const base = buildPaymentProblem(cost, 0, [], 0);
    const two = assignAlternativePayment(base, [{ id: 'a', colors: ['G'] }, { id: 'b', colors: ['R'] }], 0, 0);
    expect(two.failed).toBeNull();
    expect(two.paid).toEqual({ colored: { W: 0, U: 0, B: 0, R: 0, G: 1 }, generic: 1 });
    expect(applyAlternativePayment(base, two.paid)).toMatchObject({ generic: 1, colored: { G: 0 }, totalMana: 1 });
    const four = assignAlternativePayment(base, [{ id: 'a', colors: ['G'] }, { id: 'b', colors: ['R'] }, { id: 'c', colors: ['R'] }, { id: 'd', colors: [] }], 0, 0);
    expect(four.failed).toEqual({ kind: 'convoke', index: 3 });
    expect(assignAlternativePayment(base, [], 3, 0).failed).toEqual({ kind: 'improvise', index: 2 });
    // The chooser takes what the cost absorbs, coloured first: never a name that pays for nothing.
    expect(chooseAlternatives(base, [{ id: 'r', colors: ['R'] }, { id: 'g', colors: ['G'] }, { id: 'w', colors: ['W'] }], ['s1'], ['y1', 'y2'])).toEqual({ convoke: ['g', 'r', 'w'], improvise: [], delve: [] });
    expect(chooseAlternatives(base, [], ['s1'], ['y1', 'y2'])).toEqual({ convoke: [], improvise: ['s1'], delve: ['y1'] });
  });

  test("Pack's Favor convoked: a green creature pays {G}, a red one {1}, the Forest the rest; a tapped creature, a stranger and a fourth are refused", () => {
    const g = armed([["Pack's Favor", 'Grizzly Bears', 'Raging Goblin', 'Forest', 'Llanowar Elves'], ['Cyclops of One-Eyed Pass']]);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const goblin = put(g, 'p1', 'Raging Goblin');
    const elves = put(g, 'p1', 'Llanowar Elves');
    const theirs = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const favor = put(g, 'p1', "Pack's Favor", 'hand');
    const offer = legalActions(g.state, ORACLE, createRegistry([...SHIPPED_SCRIPTS]), 'p1').find((a) => a.t === 'CastSpell' && a.card === favor);
    expect(offer?.t === 'CastSpell' ? offer.convoke : null, 'the offer flags the keyword').toBe(true);
    expect(offer?.t === 'CastSpell' ? offer.affordable : null, 'no mana: not affordable by the pool').toBe(false);
    // A tapped creature cannot convoke; a permanent the caster does not control cannot; a fourth pays for nothing.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [goblin], tapped: true }));
    const tappedTry = g.submit({ t: 'CastSpell', player: 'p1', card: favor, targets: [{ kind: 'card', id: bears }], convoke: [bears, goblin] });
    expect(tappedTry.ok).toBe(false);
    if (!tappedTry.ok) expect(tappedTry.message).toMatch(/Raging Goblin is already tapped/);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [goblin], tapped: false }));
    const strangerTry = g.submit({ t: 'CastSpell', player: 'p1', card: favor, targets: [{ kind: 'card', id: bears }], convoke: [theirs] });
    expect(strangerTry.ok).toBe(false);
    if (!strangerTry.ok) expect(strangerTry.message).toMatch(/not a permanent you control/);
    mana(g, 'G', 1);
    const fourthTry = g.submit({ t: 'CastSpell', player: 'p1', card: favor, targets: [{ kind: 'card', id: bears }], convoke: [bears, goblin, elves, elves] });
    expect(fourthTry.ok).toBe(false);
    if (!fourthTry.ok) expect(fourthTry.message).toMatch(/named twice/);
    // Three creatures for {2}{G}: the Bears pays {G}, the Goblin and the Elves the generic - nothing left for the mana.
    const three = g.submit({ t: 'CastSpell', player: 'p1', card: favor, targets: [{ kind: 'card', id: bears }], convoke: [bears, goblin, elves] });
    expect(three.ok, 'three creatures pay {2}{G} whole').toBe(true);
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === favor);
    expect(cast && cast.body.t === 'SpellCast' ? cast.body.obj.convoked : null).toBe(3);
    expect(g.state.cards[bears]?.tapped, 'the Bears was tapped to pay').toBe(true);
    expect(g.state.cards[goblin]?.tapped).toBe(true);
    expect(g.state.cards[elves]?.tapped, 'the Elves was tapped to convoke, not for its mana').toBe(true);
    expect(g.state.players.p1?.pool.G, 'the {G} in the pool was not spent').toBe(1);
    settle(g);
    expect(g.state.cards[favor]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Hooting Mandrills delved: three graveyard cards pay {3} of {5}{G} and are exiled, a sixth is refused; Bastion Inventor improvised taps the Sol Ring, which the plan then cannot tap', () => {
    const g = armed([['Hooting Mandrills', 'Bastion Inventor', 'Sol Ring', 'Island', 'Forest', 'Grizzly Bears', 'Raging Goblin', 'Llanowar Elves', 'Giant Spider'], ['Cyclops of One-Eyed Pass']]);
    const gy = ['Grizzly Bears', 'Raging Goblin', 'Llanowar Elves', 'Giant Spider'].map((n) => put(g, 'p1', n, 'graveyard'));
    const mandrills = put(g, 'p1', 'Hooting Mandrills', 'hand');
    mana(g, 'G', 1);
    mana(g, 'C', 2);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card: mandrills, targets: [] });
    expect(short.ok, '{5}{G} with {G}{C}{C} alone').toBe(false);
    const tooMany = g.submit({ t: 'CastSpell', player: 'p1', card: mandrills, targets: [], delve: [...gy, gy[0] as string, gy[1] as string] });
    expect(tooMany.ok).toBe(false);
    const delved = g.submit({ t: 'CastSpell', player: 'p1', card: mandrills, targets: [], delve: gy.slice(0, 3) });
    expect(delved.ok, 'three cards delved, {2}{G} from the pool').toBe(true);
    for (const c of gy.slice(0, 3)) expect(g.state.cards[c]?.zone.kind, 'delved cards are exiled').toBe('exile');
    expect(g.state.cards[gy[3] as string]?.zone.kind, 'the fourth stays').toBe('graveyard');
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === mandrills);
    expect(cast && cast.body.t === 'SpellCast' ? cast.body.obj.delved : null).toBe(3);
    settle(g);
    expect(g.state.cards[mandrills]?.zone.kind).toBe('battlefield');
    // Improvise: Sol Ring tapped to pay {1}; the mana plan pays {4}{U} from the pool and never taps the Ring.
    const ring = put(g, 'p1', 'Sol Ring');
    settle(g);
    const inventor = put(g, 'p1', 'Bastion Inventor', 'hand');
    mana(g, 'U', 1);
    mana(g, 'C', 4);
    const improvised = g.submit({ t: 'CastSpell', player: 'p1', card: inventor, targets: [], improvise: [ring] });
    expect(improvised.ok, 'the Ring pays {1}, the pool {4}{U}').toBe(true);
    expect(g.state.cards[ring]?.tapped).toBe(true);
    expect(g.state.players.p1?.pool.C, 'the pool paid four, not five').toBe(0);
    const cast2 = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === inventor);
    expect(cast2 && cast2.body.t === 'SpellCast' ? cast2.body.obj.improvised : null).toBe(1);
    settle(g);
    expect(g.state.cards[inventor]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
