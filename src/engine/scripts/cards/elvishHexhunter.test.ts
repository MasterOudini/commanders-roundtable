// `Elvish Hexhunter` — the hybrid pip paid in green, the enchantment dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELVISH_HEXHUNTER_SCRIPT } from './elvishHexhunter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HEXHUNTER = 'Elvish Hexhunter';
const ENCHANTMENT = 'Contemplation';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; hexhunter: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HEXHUNTER], [ENCHANTMENT]],
    scripts: createRegistry([ELVISH_HEXHUNTER_SCRIPT]),
  });
  const hexhunter = put(g, 'p1', HEXHUNTER);
  const theirs = put(g, 'p2', ENCHANTMENT);
  settle(g);
  // {T} in the cost — the Hexhunter must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  return { g, hexhunter, theirs };
}

describe('Elvish Hexhunter', () => {
  test('the {G/W} pip paid in green destroys the enchantment', () => {
    const { g, hexhunter, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hexhunter, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[hexhunter]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, hexhunter, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hexhunter, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
