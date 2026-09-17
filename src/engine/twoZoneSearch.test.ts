// D483 - THE TWO-ZONE SEARCH. `Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it,
// and put it into your hand. If you search your library this way, shuffle.` (Elspeth's Devotee): the search prompt over
// the library AND the searcher's graveyard - the graveyard is public, so nothing more is revealed; the answer may name a
// card in either zone and it moves from where it is; the library counts as searched and the printed shuffle runs. What
// is proven here: the Elspeth in the GRAVEYARD is found and goes to the hand (the library shuffled); the Elspeth in the
// LIBRARY is found the way every search finds; a card in neither zone is refused; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { ELSPETH_S_DEVOTEE } from '../data/fixtures/engineCards';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';

const PAYLOAD = 'Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.';
const VOCAB = vocabularyEffects(PAYLOAD, ELSPETH_S_DEVOTEE.name);
const TARGETS = vocabularyTargets(PAYLOAD);
/** The Devotee's own line as a generated row would carry it: an optional entry trigger resolving the vocabulary. */
const DEVOTEE: CardScript = {
  oracleId: ELSPETH_S_DEVOTEE.oracleId,
  name: ELSPETH_S_DEVOTEE.name,
  triggers: [{
    abilityId: 'etb', text: ELSPETH_S_DEVOTEE.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: true,
    matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
    label: () => 'the Devotee searches',
    resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB, TARGETS),
  }],
};

const HERO = 'Elspeth, Undaunted Hero';
function armed(where: 'graveyard' | 'library') {
  const g = startedGame({ players: 2, decks: [["Elspeth's Devotee", HERO, 'Grizzly Bears'], ['Hill Giant', 'Grizzly Bears']], scripts: createRegistry([DEVOTEE]) });
  holdEverywhere(g);
  const devotee = put(g, 'p1', "Elspeth's Devotee", 'hand');
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // Staged past the draw steps, or the library copy is drawn before the search looks (D232's hazard).
  const hero = put(g, 'p1', HERO, 'graveyard');
  if (where === 'library') must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hero, to: { kind: 'library', player: 'p1' } }));
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: devotee, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
  const ask = g.state.priority.awaiting;
  must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
  // The row carries the trigger's 'you may' as the trigger's own option, so the search itself is not offered twice.
  const search = g.state.priority.awaiting;
  expect(search?.kind === 'searchLibrary' ? search.graveyardToo : null).toBe(true);
  return { g, hero };
}

describe('D483 - the two-zone search', () => {
  test('the vocabulary reads the shape whole, with the graveyard flag and the shuffle', () => {
    const p = parseEffects('Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.', '~', true);
    expect(p.mode).toBe('auto');
    expect(p.effects[0]?.search).toMatchObject({ graveyardToo: true, shuffle: true, destination: 'hand', count: 1, qualifier: { name: 'Elspeth, Undaunted Hero' } });
    expect(parseEffects('Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', '~', true).effects[0]?.search?.graveyardToo).toBeUndefined();
  });

  test('the find in the graveyard goes to the hand, and the library is shuffled', () => {
    const { g, hero } = armed('graveyard');
    const before = g.log.filter((e) => e.body.t === 'LibraryShuffled').length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [hero], declined: false }));
    expect(g.state.cards[hero]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.log.filter((e) => e.body.t === 'LibraryShuffled').length).toBe(before + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the find in the library goes to the hand; a card in neither zone is refused', () => {
    const { g, hero } = armed('library');
    const bears = put(g, 'p2', 'Grizzly Bears');
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [bears], declined: false }).ok).toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [hero], declined: false }));
    expect(g.state.cards[hero]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
