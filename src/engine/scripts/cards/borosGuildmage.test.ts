// `Boros Guildmage` — two mana-only grants (no tap, no summoning sickness):
// haste for {1}{R}, first strike for {1}{W}, both gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOROS_GUILDMAGE_SCRIPT } from './borosGuildmage';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Boros Guildmage';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** The ability at `index`, paid with one coloured mana and one generic, used on my own Bears on turn 1. */
function used(index: 0 | 1, symbol: 'R' | 'W'): { g: Game; mage: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE, BEARS], []],
    scripts: createRegistry([BOROS_GUILDMAGE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const mage = put(g, 'p1', MAGE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: index }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, mage, bears };
}

function keywords(g: Game, id: InstanceId): ReturnType<typeof derive>['keywords'] {
  const d = deps(createRegistry([BOROS_GUILDMAGE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('Boros Guildmage', () => {
  test('{1}{R}: haste, with the Guildmage untapped and fresh', () => {
    const { g, mage, bears } = used(0, 'R');
    expect(keywords(g, bears).has('haste')).toBe(true);
    expect(g.state.cards[mage]?.tapped).toBe(false);
  });

  test('{1}{W}: first strike', () => {
    const { g, bears } = used(1, 'W');
    expect(keywords(g, bears).has('firstStrike')).toBe(true);
    expect(keywords(g, bears).has('haste')).toBe(false);
  });

  test('cleanup takes the grant back (CR 514.2)', () => {
    const { g, bears } = used(0, 'R');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(keywords(g, bears).has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = used(1, 'W');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
