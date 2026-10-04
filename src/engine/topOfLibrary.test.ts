// D623 - PLAYING FROM THE TOP OF THE LIBRARY. A permanent's continuous permission (`TopOfLibraryDef` on its script, a
// line the engine consults): `You may look at the top card of your library any time.` (look), `Play with the top card of
// your library revealed.` (revealed), `You may play lands from the top of your library.` (lands) and `You may cast <noun>
// spells from the top of your library.` (spells - any, or the noun's predicates). What is proven: the top card offered and
// played as a land (the land drop spent) and cast as a spell from the library; only the TOP card; the noun refusing a
// spell it does not name; no permission, no offer and a refused intent; the projection - the top card shown to its owner
// under a look, to every seat under a reveal, to nobody without one; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { Projector } from './project';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { faceOf } from './oracle';
import type { CardScript, TopOfLibraryDef } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const nameOf = (g: Game, id: InstanceId) => { const inst = g.state.cards[id]; const p = inst ? ORACLE.byPrinting(inst.printingId) : undefined; return p ? faceOf(p, inst?.faceIndex ?? 0).name : '?'; };
/** The named card of p1's (library or hand) moved to the top of p1's library; returns its id. */
const toTop = (g: Game, name: string): InstanceId => {
  const id = (Object.keys(g.state.cards) as InstanceId[]).find((c) => nameOf(g, c) === name && (g.state.cards[c]?.zone.kind === 'library' || g.state.cards[c]?.zone.kind === 'hand') && g.state.cards[c]?.zone.player === 'p1');
  if (!id) throw new Error(name + ' is not in the library or the hand');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  return id;
};
const HOST = 'Sol Ring';
/** The host artifact carrying the permission defs under test. */
function host(defs: readonly TopOfLibraryDef[]): CardScript {
  const card = ORACLE.byName(HOST);
  if (!card) throw new Error(HOST + ' is not in the fixtures');
  return { oracleId: card.oracleId, name: HOST, topOfLibrary: defs };
}
const CREATURE = { supertypes: [], types: ['Creature'], subtypes: [], colors: [] };
const FUTURE: readonly TopOfLibraryDef[] = [
  { abilityId: 'top-0', text: 'Play with the top card of your library revealed.', revealed: true },
  { abilityId: 'top-1', text: 'You may play lands and cast spells from the top of your library.', lands: true, spells: 'any' },
];
const HORDE: readonly TopOfLibraryDef[] = [
  { abilityId: 'top-0', text: 'You may look at the top card of your library any time.', look: true },
  { abilityId: 'top-1', text: 'You may cast creature spells from the top of your library.', spells: { predicates: [CREATURE] } },
];
function armed(defs: readonly TopOfLibraryDef[] | null): Game {
  const g = startedGame({ players: 2, decks: [[HOST, 'Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']], scripts: createRegistry(defs ? [host(defs)] : []) });
  holdEverywhere(g);
  main(g, 3);
  put(g, 'p1', HOST);
  settle(g);
  return g;
}
const offers = (g: Game, id: InstanceId) => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => (a.t === 'CastSpell' || a.t === 'PlayLand') && a.card === id);

describe('D623 - playing from the top of the library', () => {
  test('the top card offered and played: a land with the land drop, a spell from the library; the replay hash', () => {
    const g = armed(FUTURE);
    const forest = toTop(g, 'Forest');
    expect(offers(g, forest).map((a) => a.t)).toEqual(['PlayLand']);
    const drops = g.state.players['p1']?.landsPlayedThisTurn ?? 0;
    must(g.submit({ t: 'PlayLand', player: 'p1', card: forest }));
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.landsPlayedThisTurn).toBe(drops + 1);
    const bears = toTop(g, 'Grizzly Bears');
    const cast = offers(g, bears);
    expect(cast.map((a) => a.t)).toEqual(['CastSpell']);
    expect(cast[0]?.t === 'CastSpell' ? cast[0].from.kind : null).toBe('library');
    mana(g, 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('only the TOP card; the noun refuses a spell it does not name', () => {
    const g = armed(HORDE);
    const bears = toTop(g, 'Grizzly Bears');
    const bolt = toTop(g, 'Lightning Bolt');
    expect(offers(g, bolt), 'an instant is not a creature spell').toEqual([]);
    expect(offers(g, bears), 'the second card is not the top').toEqual([]);
    mana(g, 'RGG');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }).ok).toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }).ok).toBe(false);
    const forest = toTop(g, 'Forest');
    expect(offers(g, forest), 'no land permission').toEqual([]);
    expect(g.submit({ t: 'PlayLand', player: 'p1', card: forest }).ok).toBe(false);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: forest, to: { kind: 'library', player: 'p1' }, placement: 'bottom' }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'library', player: 'p1' }, placement: 'bottom' }));
    expect(offers(g, bears).map((a) => a.t)).toEqual(['CastSpell']);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('no permission: no offer, and the intents are refused', () => {
    const g = armed(null);
    const forest = toTop(g, 'Forest');
    expect(offers(g, forest)).toEqual([]);
    expect(g.submit({ t: 'PlayLand', player: 'p1', card: forest }).ok).toBe(false);
    const bears = toTop(g, 'Grizzly Bears');
    mana(g, 'GG');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }).ok).toBe(false);
  });

  test('the projection: the top card to its owner under a look, to every seat under a reveal, to nobody without one', () => {
    const look = armed(HORDE);
    const a = toTop(look, 'Grizzly Bears');
    const mine = new Projector(ORACLE, look.deps.scripts, 'p1').project(look.state);
    const theirs = new Projector(ORACLE, look.deps.scripts, 'p2').project(look.state);
    expect(mine.seats['p1']?.libraryTop).toBe(a);
    expect(mine.cards[a]?.card?.name).toBe('Grizzly Bears');
    expect(theirs.seats['p1']?.libraryTop, 'a look is its owner' + String.fromCharCode(39) + 's alone').toBeUndefined();
    expect(theirs.cards[a]?.card ?? null).toBeNull();
    const reveal = armed(FUTURE);
    const b = toTop(reveal, 'Lightning Bolt');
    const other = new Projector(ORACLE, reveal.deps.scripts, 'p2').project(reveal.state);
    expect(other.seats['p1']?.libraryTop).toBe(b);
    expect(other.cards[b]?.card?.name).toBe('Lightning Bolt');
    const none = armed(null);
    const c = toTop(none, 'Grizzly Bears');
    const own = new Projector(ORACLE, none.deps.scripts, 'p1').project(none.state);
    expect(own.seats['p1']?.libraryTop).toBeUndefined();
    expect(own.cards[c]?.card ?? null).toBeNull();
  });
});
