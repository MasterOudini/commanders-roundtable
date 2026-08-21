// `Spiteful Blow` — the probed two-spec destroy: a creature AND a land in
// one cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPITEFUL_BLOW_SCRIPT } from './spitefulBlow';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blown(): { g: Game; bears: InstanceId; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spiteful Blow'], ['Grizzly Bears', 'Swamp']],
    scripts: createRegistry([SPITEFUL_BLOW_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const swamp = put(g, 'p2', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spiteful Blow', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: swamp },
      ],
    }),
  );
  settle(g);
  return { g, bears, swamp };
}

describe('Spiteful Blow', () => {
  test('both targets die in one resolve', () => {
    const { g, bears, swamp } = blown();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = blown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
