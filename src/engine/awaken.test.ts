// D548 - AWAKEN (CR 702.113a): "Awaken N—{cost} (If you cast this spell for {cost}, also put N +1/+1 counters on target
// land you control and it becomes a 0/0 Elemental creature with haste. It's still a land.)" D449's keyword alternative
// cost whose election adds a target - a land you control - after the printed clauses (`castTargetSpecs`), and a rider
// after the spell's own effect: N +1/+1 counters and a lasting mark (`CardInstance.awakened`) derive reads. What is
// proven here: the reading and the lines accounted; Coastal Discovery awakened - two cards drawn, the Island a 4/4
// Elemental creature land with haste, and a new object once it leaves; cast for its mana cost - no land asked for; Clutch
// of Currents awakened with its creature gone before it resolves - the spell still resolves for the land (CR 608.2b over
// the longer list); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';

const LANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const handOf = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
const mana = (g: Game, n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: n }));

describe('D548 - awaken', () => {
  test('the reading: the awaken cost and its count, the lines accounted', () => {
    for (const [name, raw, n] of [['Coastal Discovery', '{5}{U}', 4], ['Clutch of Currents', '{4}{U}', 3]] as const) {
      const face = faceNamed(name);
      expect(face.alternativeCost?.keyword, name).toBe('awaken');
      expect(face.alternativeCost?.costText, name).toBe(raw);
      expect(face.alternativeCost?.awaken, name).toBe(n);
      const card = ENGINE_CARDS.find((c) => c.name === name);
      const printed = card?.faces[0];
      if (!card || !printed) throw new Error('no fixture ' + name);
      expect(face.effectMode, `${name}: the spell's own sentences read`).toBe('auto');
      expect(engineCompleteness(card), `${name}: the whole card the engine's (a spell's rule, not a permanent's lines)`).toEqual({ complete: true, leftover: [] });
    }
  });

  test('Coastal Discovery awakened: two cards, and the Island a 4/4 Elemental creature land with haste until it leaves', () => {
    const g = startedGame({ players: 2, decks: [['Coastal Discovery', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Coastal Discovery', 'hand');
    const island = put(g, 'p1', 'Island');
    main3(g);
    const hand0 = handOf(g);
    mana(g, 6);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, alternative: true, targets: [{ kind: 'card', id: island }] }));
    settle(g);
    expect(handOf(g), 'the spell left the hand and drew two').toBe(hand0 - 1 + 2);
    expect(g.state.cards[island]?.counters['+1/+1']).toBe(4);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, island);
    expect(d.typeLine.types).toEqual(expect.arrayContaining(['Land', 'Creature']));
    expect(d.typeLine.subtypes).toContain('Elemental');
    expect(d.keywords.has('haste')).toBe(true);
    expect([d.power, d.toughness]).toEqual([4, 4]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: island, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: island, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    const again = derive(g.state, g.deps.oracle, g.deps.scripts, island);
    expect(again.typeLine.types.includes('Creature'), 'a new object is no creature').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('cast for its mana cost: no land is asked for, and nothing is awakened', () => {
    const g = startedGame({ players: 2, decks: [['Coastal Discovery', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Coastal Discovery', 'hand');
    const island = put(g, 'p1', 'Island');
    main3(g);
    const hand0 = handOf(g);
    mana(g, 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(handOf(g)).toBe(hand0 - 1 + 2);
    expect(g.state.cards[island]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(g.state.cards[island]?.awakened).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Clutch of Currents awakened, its creature gone before it resolves: the spell still resolves for the land', () => {
    const g = startedGame({ players: 2, decks: [['Clutch of Currents', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Clutch of Currents', 'hand');
    const island = put(g, 'p1', 'Island');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    mana(g, 5);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, alternative: true, targets: [{ kind: 'card', id: bears }, { kind: 'card', id: island }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'SpellFizzled'), 'one legal target left: it resolves').toBe(false);
    expect(g.state.cards[island]?.counters['+1/+1']).toBe(3);
    expect(g.state.cards[island]?.awakened).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
