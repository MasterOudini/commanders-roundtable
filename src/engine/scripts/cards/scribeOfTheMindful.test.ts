// `Scribe of the Mindful` — the self-sac return brings the Bolt home.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCRIBE_OF_THE_MINDFUL_SCRIPT } from './scribeOfTheMindful';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scribed(): { g: Game; scribe: InstanceId; bolt: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Scribe of the Mindful', 'Lightning Bolt'], []],
    scripts: createRegistry([SCRIBE_OF_THE_MINDFUL_SCRIPT]),
  });
  const scribe = put(g, 'p1', 'Scribe of the Mindful');
  const bolt = put(g, 'p1', 'Lightning Bolt', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: scribe,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bolt }],
    }),
  );
  settle(g);
  return { g, scribe, bolt };
}

describe('Scribe of the Mindful', () => {
  test('the Scribe pays itself and the Bolt comes to hand', () => {
    const { g, scribe, bolt } = scribed();
    expect(g.state.cards[scribe]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bolt]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g } = scribed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
