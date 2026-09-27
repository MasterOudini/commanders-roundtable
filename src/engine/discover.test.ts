// D572 - DISCOVER N (CR 701.57a): "Exile cards from the top of your library until you exile a nonland card with mana
// value N or less. You may cast that card without paying its mana cost. If you don't, put that card into your hand. Put
// the remaining exiled cards on the bottom of your library in a random order." Cascade's procedure (D525) as a vocabulary
// effect kind, planned aimless: the walk to the first nonland card with mana value N or LESS, the rest to the bottom off
// the seeded generator, the hit asked through cascade's pool prompt with `declineToHand`. What is proven here: the reading
// (the plain count, `then`, an X unread; Daring Discovery complete); an enter trigger's discover past a Forest and an Air
// Elemental (mana value 5 > 3) into the Bears - cast for nothing; declined - the Bears into the hand, the passed cards on
// the bottom; a library of lands - nothing asked; a DIES trigger's discover still discovers (planned aimless, not
// self-aimed - D569's trap); the replay hash.
import { describe, expect, test } from 'vitest';
import { DARING_DISCOVERY, GEOLOGICAL_APPRAISER, PRIMORDIAL_GNAWER } from '../data/fixtures/engineCards';
import { engineCompleteness } from '../data/engineComplete';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const DISCOVER_3 = vocabularyEffects('Discover 3.', GEOLOGICAL_APPRAISER.name);
const NO_TARGETS = vocabularyTargets('Discover 3.');
// Test scripts: the Appraiser's enter trigger without its `if you cast it` gate, the Gnawer's dies trigger.
const APPRAISER: CardScript = {
  oracleId: GEOLOGICAL_APPRAISER.oracleId,
  name: GEOLOGICAL_APPRAISER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: 'When this creature enters, discover 3.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Geological Appraiser - discover 3',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, DISCOVER_3, NO_TARGETS),
    },
  ],
};
const GNAWER: CardScript = {
  oracleId: PRIMORDIAL_GNAWER.oracleId,
  name: PRIMORDIAL_GNAWER.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: 'When this creature dies, discover 3.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Primordial Gnawer - discover 3',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, DISCOVER_3, NO_TARGETS),
    },
  ],
};
const SCRIPTS = createRegistry([APPRAISER, GNAWER]);
const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const onTop = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const asked = (g: Game) => advanceUntil(g, (s) => (s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true) || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
const zone = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;

/** The Appraiser (or the Gnawer) in hand; the Bears under an Air Elemental under a Forest on top of the library. */
function armed(who: 'Geological Appraiser' | 'Primordial Gnawer'): { g: Game; self: InstanceId; bears: InstanceId; air: InstanceId; forest: InstanceId } {
  const g = startedGame({ players: 2, decks: [[who, 'Grizzly Bears', 'Air Elemental', ...FORESTS], ['Grizzly Bears']], scripts: SCRIPTS, options: { maxHandSize: null } });
  holdEverywhere(g);
  const self = put(g, 'p1', who, 'hand');
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  const air = put(g, 'p1', 'Air Elemental', 'hand');
  const forest = put(g, 'p1', 'Forest', 'hand');
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
  onTop(g, bears);
  onTop(g, air);
  onTop(g, forest);
  return { g, self, bears, air, forest };
}

describe('D572 - discover', () => {
  test('the reading: the plain count and its `then`, an X unread; the keyword-action spell complete', () => {
    expect(DISCOVER_3.map((e) => [e.kind, e.amount])).toEqual([['discover', 3]]);
    expect(vocabularyEffects('Then discover 2.', 'x').map((e) => [e.kind, e.amount])).toEqual([['discover', 2]]);
    expect(() => vocabularyEffects('Discover X.', 'x'), 'an X stays unread').toThrow();
    expect(engineCompleteness(DARING_DISCOVERY).complete, 'Daring Discovery').toBe(true);
  });

  test('the Appraiser enters and discovers 3: past the Forest and the Air Elemental into the Bears, cast for nothing', () => {
    const { g, self, bears, air, forest } = armed('Geological Appraiser');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    asked(g);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'chooseFromZone') throw new Error(`expected the discover pick, got ${a?.kind ?? 'none'}`);
    expect([a.zone, a.pool, a.declineToHand]).toEqual(['exile', [bears], true]);
    expect([zone(g, air), zone(g, forest)], 'the passed cards are back in the library').toEqual(['library', 'library']);
    expect((g.state.zones.library.p1 ?? []).slice(0, 2).sort(), 'on the bottom').toEqual([air, forest].sort());
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(zone(g, bears)).toBe('battlefield');
    expect(g.log.some((e) => e.body.t === 'SpellCast' && e.body.obj.freeCast === true && e.body.obj.card === bears), 'cast for nothing').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined: the Bears go into the hand, not the bottom', () => {
    const { g, self, bears } = armed('Geological Appraiser');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    asked(g);
    expect(g.state.priority.awaiting?.kind).toBe('chooseFromZone');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(zone(g, bears)).toBe('hand');
    expect(g.state.playPermissions.some((p) => p.card === bears), 'the permission left with the card').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a library of lands alone: exiled whole, put back on the bottom, nothing asked', () => {
    const g = startedGame({ players: 2, decks: [['Geological Appraiser', ...FORESTS], ['Grizzly Bears']], scripts: SCRIPTS, options: { maxHandSize: null } });
    holdEverywhere(g);
    const self = put(g, 'p1', 'Geological Appraiser', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const size = (g.state.zones.library.p1 ?? []).length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    const n0 = g.log.length;
    settle(g);
    expect(g.log.slice(n0).some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone'), 'no question').toBe(false);
    expect((g.state.zones.library.p1 ?? []).length).toBe(size);
  });

  test('the Gnawer dies and still discovers - aimless, not self-aimed (its source is in the graveyard)', () => {
    const { g, self, bears } = armed('Primordial Gnawer');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    asked(g);
    const a = g.state.priority.awaiting;
    expect(a?.kind === 'chooseFromZone' ? a.pool : null).toEqual([bears]);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(zone(g, bears)).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
