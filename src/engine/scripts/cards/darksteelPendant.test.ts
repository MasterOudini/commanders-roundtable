// `Darksteel Pendant` — the paid tap sees ONE; the artifact itself shrugs
// off a scripted destroy (its keyword line is Tier 2, not the def's job).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DARKSTEEL_PENDANT_SCRIPT } from './darksteelPendant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scried(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Darksteel Pendant', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DARKSTEEL_PENDANT_SCRIPT]),
  });
  const pendant = put(g, 'p1', 'Darksteel Pendant');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pendant, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Darksteel Pendant', () => {
  test('the paid tap reveals ONE and the answer clears', () => {
    const { g, revealed } = scried();
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = scried();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
