// `Treasure Hunt` — the run stops on the first NONLAND and includes it, so
// the library top is engineered and the arrival counted off the LOG.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TREASURE_HUNT_SCRIPT } from './treasureHunt';
import { TREASURE_HUNT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Treasure Hunt';
const LAND = 'Mountain';
const NONLAND = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Stacks `top` onto p1's library, LAST element ending up on top. */
function stack(g: Game, names: readonly string[]): InstanceId[] {
  const ids: InstanceId[] = [];
  for (const n of names) ids.push(put(g, 'p1', n, 'graveyard'));
  for (const id of ids) {
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: id,
        to: { kind: 'library', player: 'p1' },
        placement: 'top',
      }),
    );
  }
  return ids;
}

function hunted(top: readonly string[]): { g: Game; ids: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...top], []],
    scripts: createRegistry([TREASURE_HUNT_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const ids = stack(g, top);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ids };
}

describe('Treasure Hunt', () => {
  test('two lands then a nonland: all THREE reach the hand', () => {
    // `stack` puts the last name on top, so the top-down order is
    // NONLAND, LAND, LAND — reversed, the walk sees LAND, LAND, NONLAND.
    const { g, ids } = hunted([NONLAND, LAND, LAND]);
    for (const id of ids) expect(g.state.cards[id]?.zone.kind).toBe('hand');
  });

  test('a nonland on top stops the run at ONE card', () => {
    const { g, ids } = hunted([LAND, NONLAND]);
    const [land, nonland] = ids as [InstanceId, InstanceId];
    expect(g.state.cards[nonland]?.zone.kind).toBe('hand');
    expect(g.state.cards[land]?.zone.kind).toBe('library');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TREASURE_HUNT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TREASURE_HUNT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TREASURE_HUNT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hunted([NONLAND, LAND]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
