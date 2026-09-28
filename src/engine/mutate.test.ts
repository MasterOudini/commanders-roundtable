// D581 - MUTATE (CR 702.140) and THE MERGED PERMANENT (CR 730). `Mutate {cost}` is a keyword alternative cost: elected,
// the creature spell is a MUTATING one that targets a non-Human creature with its owner; as it resolves with that target
// still legal, its controller puts it over or under (`mutateOrder`) and it merges - one permanent, the TARGET's (its
// counters and id kept), with the top card's characteristics and every card's abilities; its target gone, it enters as a
// creature (never countered for it). Leaving the battlefield, every card goes. What is proven here: the reading (the
// cost, the keyword, the target - non-Human, owned by the caster, any controller); the offer (a Human refused, an
// opponent's creature refused, the caster's own accepted); OVER - Gemrazer's characteristics on the Bears' permanent,
// its counter kept, both cards' keywords, the Mutated event; UNDER - the Bears' characteristics with Dreamtail Heron's
// flying and its `mutates` trigger (a test script) drawing a card; the target gone - the Heron enters, uncountered; the
// merged permanent dies - both cards in the graveyard, the host its printed self again; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { castTargetSpecs } from './legal';
import { createRegistry } from './scripts/registryCore';
import type { CardScript } from './scripts/api';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { drawEvents } from './effects';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';

const HERON = 'Dreamtail Heron';
const GEM = 'Gemrazer';
const HUMAN = 'Thraben Standard Bearer';
const BEARS = 'Grizzly Bears';
const cardOf = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c; };

// A test script for the Heron's own trigger (the rows ship the real one): `Whenever this creature mutates, draw a card.`
const HERON_SCRIPT: CardScript = {
  oracleId: cardOf(HERON).oracleId,
  name: HERON,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: 'Whenever this creature mutates, draw a card.',
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => 'Dreamtail Heron - draw',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
const SCRIPTS = createRegistry([HERON_SCRIPT]);

const LANDS = ['Forest', 'Forest', 'Island', 'Island', 'Forest', 'Island', 'Forest', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const toPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'mutateOrder' || s.stack.length === 0, 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const mana = (g: Game, sym: 'G' | 'U' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const d = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id);
const handOf = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
const answer = (g: Game, over: boolean) => {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'mutateOrder') throw new Error('no mutate question: ' + JSON.stringify(a));
  must(g.submit({ t: 'AnswerMutateOrder', player: 'p1', stackId: a.stackId, over }));
};

describe('D581 - mutate', () => {
  test('the reading: the mutate cost, the keyword, and the target it makes the spell take', () => {
    for (const [name, raw] of [[GEM, '{1}{G}{G}'], [HERON, '{3}{U}']] as const) {
      const face = faceOf(cardOf(name), 0);
      expect(face.alternativeCost?.keyword, name).toBe('mutate');
      expect(face.alternativeCost?.costText, name).toBe(raw);
      expect(face.keywords, name).toContain('mutate');
      expect(castTargetSpecs(face, false), name + ': cast for its mana cost, no target').toEqual([]);
      const specs = castTargetSpecs(face, true);
      expect(specs.length, name).toBe(1);
      expect(specs[0]?.kinds).toEqual(['creature']);
      expect(specs[0]?.controller, 'any controller - owned by the caster').toBe('any');
      expect(specs[0]?.restrict?.subtypesNone).toEqual(['Human']);
      expect(specs[0]?.restrict?.ownedByYou).toBe(true);
    }
  });

  test('the offer: a Human is refused, an opponent' + "'" + 's creature is refused, the caster' + "'" + 's own is taken', () => {
    const g = startedGame({ players: 2, decks: [[GEM, HUMAN, BEARS, ...LANDS], [BEARS, ...LANDS]] });
    holdEverywhere(g);
    const gem = put(g, 'p1', GEM, 'hand');
    const human = put(g, 'p1', HUMAN);
    const mine = put(g, 'p1', BEARS);
    const theirs = put(g, 'p2', BEARS);
    main3(g);
    mana(g, 'G', 3);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: gem, alternative: true, targets: [{ kind: 'card', id: human }] }).ok, 'a Human').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: gem, alternative: true, targets: [{ kind: 'card', id: theirs }] }).ok, 'the opponent' + "'" + 's').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gem, alternative: true, targets: [{ kind: 'card', id: mine }] }));
    expect(g.state.stack.length).toBe(1);
  });

  test('over: Gemrazer' + "'" + 's characteristics on the Bears' + "'" + ' permanent - its id and its counter kept, both keywords sets', () => {
    const g = startedGame({ players: 2, decks: [[GEM, BEARS, ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const gem = put(g, 'p1', GEM, 'hand');
    const bears = put(g, 'p1', BEARS);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    main3(g);
    mana(g, 'G', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gem, alternative: true, targets: [{ kind: 'card', id: bears }] }));
    toPrompt(g);
    answer(g, true);
    settle(g);
    const host = g.state.cards[bears];
    expect(host?.zone.kind, 'the Bears' + "'" + ' permanent stays').toBe('battlefield');
    expect(host?.merged, 'Gemrazer on top').toEqual([gem, bears]);
    expect(g.state.cards[gem]?.zone.kind).toBe('merged');
    expect(g.state.cards[gem]?.mergedInto).toBe(bears);
    expect(g.state.zones.battlefield.includes(gem), 'the spell never entered').toBe(false);
    const c = d(g, bears);
    expect(c.name).toBe(GEM);
    expect([c.power, c.toughness], 'a 4/4 with the Bears' + "'" + ' counter').toEqual([5, 5]);
    expect(c.keywords.has('reach') && c.keywords.has('trample')).toBe(true);
    expect(g.log.some((e) => e.body.t === 'Mutated' && e.body.host === bears && e.body.onTop)).toBe(true);
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === gem && m.to.kind === 'battlefield')), 'no entry').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('under: the Bears' + "'" + ' characteristics with the Heron' + "'" + 's flying, and the Heron' + "'" + 's mutates trigger draws', () => {
    const g = startedGame({ players: 2, decks: [[HERON, BEARS, ...LANDS], [...LANDS]], scripts: SCRIPTS });
    holdEverywhere(g);
    const heron = put(g, 'p1', HERON, 'hand');
    const bears = put(g, 'p1', BEARS);
    main3(g);
    const hand0 = handOf(g);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: heron, alternative: true, targets: [{ kind: 'card', id: bears }] }));
    toPrompt(g);
    answer(g, false);
    settle(g);
    expect(g.state.cards[bears]?.merged, 'the Heron underneath').toEqual([bears, heron]);
    const c = d(g, bears);
    expect(c.name).toBe(BEARS);
    expect([c.power, c.toughness]).toEqual([2, 2]);
    expect(c.keywords.has('flying'), 'the Heron' + "'" + 's ability from under it').toBe(true);
    expect(handOf(g), 'cast one, drew one').toBe(hand0 - 1 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the target gone: the mutating spell enters as a creature, never countered for it', () => {
    const g = startedGame({ players: 2, decks: [[HERON, BEARS, ...LANDS], [...LANDS]], scripts: SCRIPTS });
    holdEverywhere(g);
    const heron = put(g, 'p1', HERON, 'hand');
    const bears = put(g, 'p1', BEARS);
    main3(g);
    const hand0 = handOf(g);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: heron, alternative: true, targets: [{ kind: 'card', id: bears }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'SpellFizzled'), 'not countered').toBe(false);
    expect(g.state.cards[heron]?.zone.kind, 'it entered').toBe('battlefield');
    expect(g.log.some((e) => e.body.t === 'Mutated')).toBe(false);
    expect(handOf(g), 'no mutation, no draw').toBe(hand0 - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the merged permanent dies: every card goes, the host its printed self again', () => {
    const g = startedGame({ players: 2, decks: [[GEM, BEARS, ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const gem = put(g, 'p1', GEM, 'hand');
    const bears = put(g, 'p1', BEARS);
    main3(g);
    mana(g, 'G', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gem, alternative: true, targets: [{ kind: 'card', id: bears }] }));
    toPrompt(g);
    answer(g, true);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const gy = g.state.zones.graveyard.p1 ?? [];
    expect(gy.includes(bears) && gy.includes(gem), 'both cards').toBe(true);
    expect(g.state.cards[bears]?.oracleId, 'the Bears again').toBe(cardOf(BEARS).oracleId);
    expect(g.state.cards[bears]?.merged).toBeUndefined();
    expect(g.state.cards[gem]?.mergedInto).toBeUndefined();
    expect(Object.values(g.state.cards).some((c) => c.zone.kind === 'merged'), 'nothing left merged').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
