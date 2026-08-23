// `Toil to Renown` — the tapped-permanent census, and the point of the test
// is the ARTIFACT CREATURE: the card asks for a count of permanents, not a
// sum per type, so a permanent that is two of the three counts ONCE.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TOIL_TO_RENOWN_SCRIPT } from './toilToRenown';
import { TOIL_TO_RENOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Toil to Renown';
const RING = 'Sol Ring'; // artifact
const SOULEATER = 'Blinding Souleater'; // artifact AND creature — one permanent
const BEARS = 'Grizzly Bears'; // creature
const MOUNTAIN = 'Mountain'; // land

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Taps `tap`, leaves `standing` upright, and casts the spell. */
function toiled(tap: readonly string[], standing: readonly string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...tap, ...standing], [MOUNTAIN]],
    scripts: createRegistry([TOIL_TO_RENOWN_SCRIPT]),
  });
  const tapped: InstanceId[] = tap.map((n) => put(g, 'p1', n));
  standing.forEach((n) => put(g, 'p1', n));
  // An opponent's tapped land must not count.
  const theirs = put(g, 'p2', MOUNTAIN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  if (tapped.length > 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: tapped, tapped: true }));
  }
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [theirs], tapped: true }));
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Toil to Renown', () => {
  test('four tapped permanents pay 4 — the artifact CREATURE counts once', () => {
    // Ring + Souleater + Bears + Mountain. A per-type sum would say 5.
    const g = toiled([RING, SOULEATER, BEARS, MOUNTAIN], []);
    expect(g.state.players.p1?.life).toBe(44);
  });

  test('an UNTAPPED permanent of mine pays nothing', () => {
    const g = toiled([MOUNTAIN], [BEARS, RING]);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('nothing tapped is a true no-op', () => {
    const g = toiled([], [BEARS, RING]);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TOIL_TO_RENOWN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TOIL_TO_RENOWN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TOIL_TO_RENOWN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = toiled([RING, MOUNTAIN], []);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
