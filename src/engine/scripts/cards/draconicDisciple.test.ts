// `Draconic Disciple` — the self-sacrifice Dragon, spent at activation.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRACONIC_DISCIPLE_SCRIPT } from './draconicDisciple';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DISCIPLE = 'Draconic Disciple';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; disciple: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DISCIPLE], []],
    scripts: createRegistry([DRACONIC_DISCIPLE_SCRIPT]),
  });
  const disciple = put(g, 'p1', DISCIPLE);
  settle(g);
  // {T} in the cost — the Disciple must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  return { g, disciple };
}

describe('Draconic Disciple', () => {
  test('the 5/5 Dragon arrives with the Disciple spent as part of the cost', () => {
    const { g, disciple } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: disciple, abilityIndex: 1, targets: [] }));
    expect(g.state.cards[disciple]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Dragon')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g, disciple } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: disciple, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
