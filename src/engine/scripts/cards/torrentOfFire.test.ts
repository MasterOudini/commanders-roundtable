// `Torrent of Fire` — the greatest mana value among MY permanents, aimed
// anywhere. An opponent's expensive permanent must not raise it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TORRENT_OF_FIRE_SCRIPT } from './torrentOfFire';
import { TORRENT_OF_FIRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Torrent of Fire';
const RING = 'Sol Ring'; // mv 1
const BEARS = 'Grizzly Bears'; // mv 2
const TITAN = 'Grave Titan'; // mv 6

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Puts `mine` under p1 and `theirs` under p2, then burns p2's face. */
function burned(mine: readonly string[], theirs: readonly string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...mine], [...theirs]],
    scripts: createRegistry([TORRENT_OF_FIRE_SCRIPT]),
  });
  mine.forEach((n) => put(g, 'p1', n));
  theirs.forEach((n) => put(g, 'p2', n));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Torrent of Fire', () => {
  test('the GREATEST of my mana values is the damage', () => {
    const g = burned([RING, BEARS, TITAN], []);
    expect(g.state.players.p2?.life).toBe(34);
  });

  test("an opponent's expensive permanent does NOT raise it", () => {
    const g = burned([RING], [TITAN]);
    expect(g.state.players.p2?.life).toBe(39);
  });

  test('an empty board of mine is a true no-op', () => {
    const g = burned([], [TITAN]);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TORRENT_OF_FIRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TORRENT_OF_FIRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TORRENT_OF_FIRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = burned([RING, TITAN], []);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
