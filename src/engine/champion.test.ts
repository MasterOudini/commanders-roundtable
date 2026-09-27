// D571 - CHAMPION (CR 702.72a): "When this permanent enters, sacrifice it unless you exile another [object] you control.
// When this permanent leaves the battlefield, return the exiled card to the battlefield under its owner's control." The
// enter trigger from the keyword table resolves D415's verb price with the champion's own verb (`championExile` - the
// face's noun as predicates); the exile carries the champion's entry stamp (D407's `until`), so the state-based return
// brings the card back when the champion leaves. What is proven here: the reading (the noun, the accounting); Changeling
// Hero asked with the Bears as its one candidate, paid - the Bears exiled, and back under their owner's control once the
// Hero leaves; declined - the Hero sacrificed; alone - sacrificed unasked; Nova Chaser's noun - an Elemental, never the
// Bears; gone before its trigger resolved - nothing asked, nothing exiled; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { NO_SCRIPTS } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { parseChampion } from '../data/oracleParse';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const PLAINS = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
function game(p1: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...PLAINS], [...PLAINS]], scripts: NO_SCRIPTS, options: { maxHandSize: null } });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
  return g;
}
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const askedChampion = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
const zone = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const payAsks = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana').length;
const CREATURE = { supertypes: [], types: ['Creature'], subtypes: [], colors: [] };

describe('champion (D571)', () => {
  test('the reading: the noun as predicates, the keyword granted on it, the keyword-only cards accounted', () => {
    expect(parseChampion('Champion a creature (When this enters, sacrifice it unless you exile another creature you control.)')).toEqual({ any: [CREATURE], noun: 'a creature' });
    expect(parseChampion('Champion a Goblin or Shaman')?.any.map((p) => p.subtypes)).toEqual([['Goblin'], ['Shaman']]);
    expect(parseChampion('Champion an Elemental')?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Elemental'], colors: [] }]);
    for (const name of ['Changeling Hero', 'Nova Chaser']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error(`no fixture ${name}`);
      expect(unaccountedLines(card, 0), name).toEqual([]);
    }
  });

  test('Changeling Hero asked with the Bears, paid: the Bears exiled - and back under their owner once the Hero leaves', () => {
    const g = game(['Changeling Hero', 'Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const hero = put(g, 'p1', 'Changeling Hero');
    askedChampion(g);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'payMana') throw new Error(`expected the champion's price, got ${a?.kind ?? 'none'}`);
    expect([a.player, a.source, a.verbs?.costText, a.candidates]).toEqual(['p1', hero, 'exile another creature you control', [bears]]);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears] }));
    settle(g);
    expect([zone(g, hero), zone(g, bears), g.state.cards[bears]?.exiledUntil?.source]).toEqual(['battlefield', 'exile', hero]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hero, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect([zone(g, hero), zone(g, bears), g.state.cards[bears]?.controller]).toEqual(['graveyard', 'battlefield', 'p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined: the Hero is sacrificed and the Bears stay', () => {
    const g = game(['Changeling Hero', 'Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const hero = put(g, 'p1', 'Changeling Hero');
    askedChampion(g);
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect([zone(g, hero), zone(g, bears)]).toEqual(['graveyard', 'battlefield']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('alone: nothing to exile, so the Hero is sacrificed unasked', () => {
    const g = game(['Changeling Hero']);
    const n0 = g.log.length;
    const hero = put(g, 'p1', 'Changeling Hero');
    settle(g);
    expect(payAsks(g, n0), 'no question').toBe(0);
    expect(zone(g, hero)).toBe('graveyard');
  });

  test('Nova Chaser champions an Elemental: the Bears are no candidate, the Air Elemental is', () => {
    const g = game(['Nova Chaser', 'Grizzly Bears', 'Air Elemental']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const air = put(g, 'p1', 'Air Elemental');
    const chaser = put(g, 'p1', 'Nova Chaser');
    askedChampion(g);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'payMana') throw new Error(`expected the champion's price, got ${a?.kind ?? 'none'}`);
    expect([a.verbs?.costText, a.candidates]).toEqual(['exile another Elemental you control', [air]]);
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears] }).ok, 'the Bears cannot pay').toBe(false);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [air] }));
    settle(g);
    expect([zone(g, chaser), zone(g, air), zone(g, bears)]).toEqual(['battlefield', 'exile', 'battlefield']);
  });

  test('gone before its trigger resolves: nothing is asked and nothing is exiled', () => {
    const g = game(['Changeling Hero', 'Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const hero = put(g, 'p1', 'Changeling Hero');
    advanceUntil(g, (s) => s.stack.some((o) => o.kind === 'triggered'), 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hero, to: { kind: 'graveyard', player: 'p1' } }));
    const n0 = g.log.length;
    settle(g);
    expect(payAsks(g, n0), 'no question').toBe(0);
    expect([zone(g, hero), zone(g, bears)]).toEqual(['graveyard', 'battlefield']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
