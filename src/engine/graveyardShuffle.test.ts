// D618 - THE GRAVEYARD SHUFFLE: `Shuffle your graveyard into your library.`, `Target player shuffles their graveyard into
// their library.`, `Each player shuffles their graveyard into their library.` (and the `hand and graveyard` forms) - the
// cards into the library, one shuffle off the seeded generator. What is proven: the reads; the aimed form (Clear the
// Mind) moves the aimed graveyard alone; the scoped form (Mnemonic Nexus) both; the caster's form behind the self-exile
// cost (Feldon's Cane by a test def); the replay hashes.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const CLEAR = 'Clear the Mind';
const NEXUS = 'Mnemonic Nexus';
const CANE = "Feldon's Cane";
const ISLANDS: string[] = Array.from({ length: 8 }, () => 'Island');

function bury(g: Game, player: 'p1' | 'p2', n: number): InstanceId[] {
  const out: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    const top = (g.state.zones.library[player] ?? [])[0];
    if (!top) break;
    must(g.submit({ t: 'ManualMoveCard', player, card: top, to: { kind: 'graveyard', player } }));
    out.push(top);
  }
  return out;
}

function resolve(g: Game, id: InstanceId): void {
  advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
}

const shuffledFor = (g: Game, p: string, from: number) => g.log.slice(from).some((e) => e.body.t === 'LibraryShuffled' && e.body.player === p);

describe('the graveyard shuffle (D618)', () => {
  test('the reads', () => {
    const r = (t: string) => parseEffects(t, CLEAR, true).effects.map((e) => [e.kind, e.targetIndex, e.scopes?.[0]?.kind === 'player' ? e.scopes[0].controller : null, e.withHand === true]);
    expect(r('Shuffle your graveyard into your library.')).toEqual([['graveyardShuffle', -1, 'you', false]]);
    expect(r('Target player shuffles their graveyard into their library.')).toEqual([['graveyardShuffle', 0, null, false]]);
    expect(r('Each player shuffles their graveyard into their library.')).toEqual([['graveyardShuffle', -1, 'any', false]]);
    expect(r('Shuffle your hand and graveyard into your library.')).toEqual([['graveyardShuffle', -1, 'you', true]]);
  });

  test('the aimed graveyard alone goes into its library', () => {
    const g = startedGame({ decks: [[...ISLANDS, CLEAR], [...ISLANDS]], scripts: createRegistry([]) });
    fullControl(g, 'p1');
    const mine = bury(g, 'p1', 1);
    const theirs = bury(g, 'p2', 2);
    const id = put(g, 'p1', CLEAR, 'hand');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const from = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, targets: [{ kind: 'player', id: 'p2' }] }));
    resolve(g, id);
    for (const c of theirs) expect(g.state.cards[c]?.zone.kind).toBe('library');
    for (const c of mine) expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
    expect(shuffledFor(g, 'p2', from)).toBe(true);
    expect((g.state.zones.hand.p1 ?? []).length, 'the spell left the hand and its card was drawn').toBe(hand0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('each graveyard goes into its own library', () => {
    const g = startedGame({ decks: [[...ISLANDS, NEXUS], [...ISLANDS]], scripts: createRegistry([]) });
    fullControl(g, 'p1');
    const mine = bury(g, 'p1', 2);
    const theirs = bury(g, 'p2', 2);
    const id = put(g, 'p1', NEXUS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id }));
    resolve(g, id);
    for (const c of [...mine, ...theirs]) expect(g.state.cards[c]?.zone.kind).toBe('library');
    expect(g.state.zones.graveyard.p2 ?? []).toEqual([]);
    expect(g.state.zones.graveyard.p1 ?? []).toEqual([id]);
  });

  test('the caster' + "'" + 's own, behind the self-exile cost', () => {
    const card = ORACLE.byName(CANE);
    if (!card) throw new Error('no fixture');
    const payload = 'Shuffle your graveyard into your library.';
    const effects = vocabularyEffects(payload, CANE);
    const targets = vocabularyTargets(payload);
    const def: CardScript = { oracleId: card.oracleId, name: CANE, activated: [{ ref: card.oracleId + '#a0', text: card.faces[0]?.oracleText ?? '', resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets) }] };
    const g = startedGame({ decks: [[...ISLANDS, CANE], [...ISLANDS]], scripts: createRegistry([def]) });
    fullControl(g, 'p1');
    const id = put(g, 'p1', CANE);
    const mine = bury(g, 'p1', 2);
    const theirs = bury(g, 'p2', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    expect(g.state.cards[id]?.zone.kind).toBe('exile');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    for (const c of mine) expect(g.state.cards[c]?.zone.kind).toBe('library');
    for (const c of theirs) expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
