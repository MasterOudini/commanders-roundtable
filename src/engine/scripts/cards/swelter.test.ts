// `Swelter` — the counted pair: both 2/2s die to one cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SWELTER_SCRIPT } from './swelter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sweltered(): { g: Game; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Swelter'], ['Grizzly Bears', 'Grizzly Bears']],
    scripts: createRegistry([SWELTER_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  if (a === b) throw new Error('the deck must hold two distinct Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Swelter', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Swelter', () => {
  test('both targets take 2 and die', () => {
    const { g, a, b } = sweltered();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = sweltered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
