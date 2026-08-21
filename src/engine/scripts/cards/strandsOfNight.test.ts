// `Strands of Night` — the THREE-PART cost is charged in full: {B}{B} from
// the pool, 2 life, and a sacrificed Swamp — then the creature comes back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRANDS_OF_NIGHT_SCRIPT } from './strandsOfNight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stranded(): { g: Game; swamp: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Strands of Night', 'Swamp', 'Grizzly Bears'], []],
    scripts: createRegistry([STRANDS_OF_NIGHT_SCRIPT]),
  });
  const strands = put(g, 'p1', 'Strands of Night');
  const swamp = put(g, 'p1', 'Swamp');
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: strands,
      abilityIndex: 0,
      sacrifice: swamp,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, swamp, bears };
}

describe('Strands of Night', () => {
  test('the Swamp dies, 2 life is paid, and the Bears returns', () => {
    const { g, swamp, bears } = stranded();
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = stranded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
