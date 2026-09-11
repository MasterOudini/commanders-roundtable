// D390 - THE PLAYER QUEUE (CR 101.4). "Each player sacrifices a creature of their choice.":
// every player in the scope chooses in APNAP order, each seeing the choices before theirs, and
// then the sacrifices happen AT ONCE. The resolution records the forced picks, asks the first
// player with a real choice and parks the rest on `pendingAsks`; the answer carries the queue
// to its end and applies every pick in ONE `CardsMoved`. "Each opponent discards N cards" is the
// same queue over the hand - the sentence D137's vocabulary refused for want of a scope.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { parseEffects as parseSentence } from '../data/effectParse';
import { advanceUntil, findAnywhere, fullControl, must, nameOf, ORACLE, put, startedGame } from './testing/harness';
import type { InstanceId } from './types/ids';
import type { PlayerId } from './types/ids';

const DECK = ['Innocent Blood', 'Unnerve', 'Tremble', 'Delirium Skeins', 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'];

function game(players: 2 | 3 = 3): Game {
  const g = startedGame({ players, decks: players === 3 ? [DECK, DECK, DECK] : [DECK, DECK] });
  fullControl(g, 'p1');
  for (let i = 0; i < 4; i++) put(g, 'p1', 'Swamp');
  return g;
}
function asking(g: Game): Extract<NonNullable<Game['state']['priority']['awaiting']>, { kind: 'chooseFromZone' }> {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseFromZone') throw new Error(`expected chooseFromZone, got ${a?.kind ?? 'none'}`);
  return a;
}
function cast(g: Game, name: string): void {
  const card = findAnywhere(g, 'p1', name);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [] }));
  advanceUntil(g, (s) => s.stack.length === 0 || s.priority.awaiting?.kind === 'chooseFromZone', 400);
}
/** The permanents a player controls with this name, on the battlefield. */
const bf = (g: Game, p: PlayerId, name: string): InstanceId[] =>
  g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === p && nameOf(g, id) === name);
const gy = (g: Game, p: PlayerId): readonly InstanceId[] => g.state.zones.graveyard[p] ?? [];
/** The `CardsMoved` bodies on the log, last first. */
const moved = (g: Game) => g.log.filter((e) => e.body.t === 'CardsMoved').map((e) => e.body).reverse();
const narrations = (g: Game): string[] => g.log.map((e) => e.body).filter((b) => b.t === 'Narrated').map((b) => (b as { text: string }).text);

describe('the sentence', () => {
  test('both shapes read whole, and the noun goes through the chooser reader', () => {
    const blood = ORACLE.byName('Innocent Blood')?.faces[0];
    expect(blood?.effectMode).toBe('auto');
    expect(blood?.effects[0]).toMatchObject({ kind: 'sacrifice', amount: 1, self: true, targetIndex: -1, scopes: [{ kind: 'player', controller: 'any' }], sacrifice: { what: 'creature' } });
    expect(blood?.effects[0]?.sacrifice?.predicates.map((p) => p.types)).toEqual([['Creature']]);
    expect(ORACLE.byName('Tremble')?.faces[0]?.effects[0]).toMatchObject({ kind: 'sacrifice', sacrifice: { what: 'land' } });
    expect(ORACLE.byName('Simplify')?.faces[0]?.effectMode).toBe('auto');
    const nerve = ORACLE.byName('Unnerve')?.faces[0];
    expect(nerve?.effectMode).toBe('auto');
    expect(nerve?.effects[0]).toMatchObject({ kind: 'discard', amount: 2, self: true, scopes: [{ kind: 'player', controller: 'opponents' }] });
    expect(ORACLE.byName('Delirium Skeins')?.faces[0]?.effects[0]).toMatchObject({ kind: 'discard', amount: 3, scopes: [{ kind: 'player', controller: 'any' }] });
    // "creature or planeswalker" is two arms of one noun (D168's reader).
    const two = parseSentence('Each opponent sacrifices a creature or planeswalker of their choice.', 'X', true);
    expect(two.mode).toBe('auto');
    expect(two.effects[0]?.sacrifice?.predicates).toHaveLength(2);
  });
  test('a word the reader cannot place, a second effect, and a rider stay refused', () => {
    expect(parseSentence('Each opponent sacrifices a creature of their choice with flying.', 'X', true).mode).not.toBe('auto');
    expect(parseSentence('Each player sacrifices a nontoken creature of their choice.', 'X', true).mode).not.toBe('auto');
    expect(ORACLE.byName("Vraska's Fall")?.faces[0]?.effectMode).not.toBe('auto');
    // It ASKS, so a sentence after it lands assisted (D195's rule), never dropped.
    expect(parseSentence('Each player sacrifices a creature of their choice. Draw a card.', 'X', true).mode).toBe('assisted');
  });
});

describe('the queue over the battlefield (Innocent Blood, three seats)', () => {
  /** p1 holds two Bears (a real choice), p2 one (forced), p3 none (nothing). */
  function armed(): Game {
    const g = game(3);
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Grizzly Bears');
    cast(g, 'Innocent Blood');
    return g;
  }
  test('the first player with a choice is asked, the rest are parked, and no id crosses', () => {
    const g = armed();
    const a = asking(g);
    expect(a).toMatchObject({ player: 'p1', zone: 'battlefield', count: 1, rest: null, label: 'Innocent Blood', filter: { what: 'creature' } });
    expect(Object.keys(a).sort()).toEqual(['count', 'filter', 'kind', 'label', 'player', 'rest', 'zone']);
    const json = JSON.stringify(a);
    for (const id of g.state.zones.battlefield) expect(json).not.toContain(id);
    expect(g.state.pendingAsks).toMatchObject({ verb: 'sacrifice', remaining: ['p2', 'p3'], count: 1, chosen: [] });
    // Nothing has moved yet: the picks happen together, at the end.
    expect(bf(g, 'p1', 'Grizzly Bears')).toHaveLength(2);
    expect(bf(g, 'p2', 'Grizzly Bears')).toHaveLength(1);
  });
  test('a pick the noun does not admit, another player\'s, the wrong count and the wrong player are refused', () => {
    const g = armed();
    const theirs = bf(g, 'p2', 'Grizzly Bears')[0]!;
    const swamp = bf(g, 'p1', 'Swamp')[0]!;
    const [a, b] = bf(g, 'p1', 'Grizzly Bears');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [theirs] }).ok).toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [swamp] }).ok).toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [a!, b!] }).ok).toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [theirs] }).ok).toBe(false);
    expect(asking(g).player).toBe('p1');
  });
  test('the answer ends the queue: the forced pick is recorded, the empty one too, and ONE batch moves them all', () => {
    const g = armed();
    const [keep, give] = bf(g, 'p1', 'Grizzly Bears');
    const theirs = bf(g, 'p2', 'Grizzly Bears')[0]!;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [give!] }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.pendingAsks).toBeNull();
    expect(bf(g, 'p1', 'Grizzly Bears')).toEqual([keep]);
    expect(gy(g, 'p1')).toContain(give);
    expect(gy(g, 'p2')).toContain(theirs);
    const batch = moved(g)[0];
    expect(batch?.t === 'CardsMoved' && batch.moves.length).toBe(2);
    expect(batch?.t === 'CardsMoved' && batch.moves.every((m) => m.reason === 'sacrifice')).toBe(true);
    expect(narrations(g).some((t) => /nothing to sacrifice/.test(t))).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
  test('two players with a choice are asked in turn, and the first pick waits for the second', () => {
    const g = game(3);
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Grizzly Bears');
    put(g, 'p2', 'Grizzly Bears');
    cast(g, 'Innocent Blood');
    const mine = bf(g, 'p1', 'Grizzly Bears')[0]!;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [mine] }));
    expect(asking(g)).toMatchObject({ player: 'p2', zone: 'battlefield' });
    // CR 101.4: p2 chooses seeing p1's pick still on the battlefield.
    expect(g.state.zones.battlefield).toContain(mine);
    expect(g.state.pendingAsks?.chosen).toEqual([{ player: 'p1', cards: [mine] }]);
    const theirs = bf(g, 'p2', 'Grizzly Bears')[1]!;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [theirs] }));
    expect(g.state.pendingAsks).toBeNull();
    const batch = moved(g)[0];
    expect(batch?.t === 'CardsMoved' && batch.moves.map((m) => m.card).sort()).toEqual([mine, theirs].sort());
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
  test('nobody with a choice means no prompt and the batch at once', () => {
    const g = game(2);
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Grizzly Bears');
    cast(g, 'Innocent Blood');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.pendingAsks).toBeNull();
    expect(bf(g, 'p1', 'Grizzly Bears')).toHaveLength(0);
    expect(bf(g, 'p2', 'Grizzly Bears')).toHaveLength(0);
  });
});

describe('the queue over the hand (Unnerve, three seats)', () => {
  test('each opponent is asked in turn, the caster is not, and the discards land together', () => {
    const g = game(3);
    const mineBefore = (g.state.zones.hand['p1'] ?? []).length;
    cast(g, 'Unnerve');
    expect(asking(g)).toMatchObject({ player: 'p2', zone: 'hand', count: 2, label: 'Unnerve' });
    expect(g.state.pendingAsks).toMatchObject({ verb: 'discard', remaining: ['p3'] });
    const p2 = (g.state.zones.hand['p2'] ?? []).slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: p2 }));
    // Recorded, not applied: p2's cards are still in hand while p3 chooses.
    expect(g.state.zones.hand['p2']).toContain(p2[0]);
    expect(asking(g)).toMatchObject({ player: 'p3', zone: 'hand', count: 2 });
    const p3 = (g.state.zones.hand['p3'] ?? []).slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p3', cards: p3 }));
    expect(g.state.priority.awaiting).toBeNull();
    const batch = moved(g)[0];
    expect(batch?.t === 'CardsMoved' && batch.moves.length).toBe(4);
    expect(batch?.t === 'CardsMoved' && batch.moves.every((m) => m.reason === 'discard')).toBe(true);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mineBefore - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
  test('a hand no bigger than the count goes whole, unasked', () => {
    const g = game(3);
    for (const id of (g.state.zones.hand['p3'] ?? []).slice(2)) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p3', card: id, to: { kind: 'library', player: 'p3' } }));
    }
    cast(g, 'Unnerve');
    const p2 = (g.state.zones.hand['p2'] ?? []).slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: p2 }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p3']).toHaveLength(0);
    expect((g.state.zones.graveyard['p3'] ?? []).length).toBe(2);
  });
});
