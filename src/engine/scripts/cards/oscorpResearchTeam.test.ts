// `Oscorp Research Team` — {6}{U} draws two, no tap.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OSCORP_RESEARCH_TEAM_SCRIPT } from './oscorpResearchTeam';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function teamed(): { g: Game; team: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Oscorp Research Team'], []],
    scripts: createRegistry([OSCORP_RESEARCH_TEAM_SCRIPT]),
  });
  const team = put(g, 'p1', 'Oscorp Research Team');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  return { g, team };
}

describe('Oscorp Research Team', () => {
  test('draws two without tapping', () => {
    const { g, team } = teamed();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: team, abilityIndex: 0 }));
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect(g.state.cards[team]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, team } = teamed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: team, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
