// `Viscera Seer` — a sacrifice chooser (D168) with NO mana in the cost at
// all, paying a scry ask (D195).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VISCERA_SEER_SCRIPT } from './visceraSeer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SEER = 'Viscera Seer';
const FOOD_FOR_IT = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(): { g: Game; seer: InstanceId; bears: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[SEER, FOOD_FOR_IT], []],
    scripts: createRegistry([VISCERA_SEER_SCRIPT]),
  });
  const bears = put(g, 'p1', FOOD_FOR_IT);
  const seer = put(g, 'p1', SEER);
  settle(g);
  must(
    g.submit({ t: 'ActivateAbility', player: 'p1', card: seer, abilityIndex: 0, sacrifice: bears }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, seer, bears, revealed };
}

describe('Viscera Seer', () => {
  test('the sacrifice is charged and a scry 1 is asked', () => {
    const { g, bears, revealed } = activated();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(revealed).toHaveLength(1);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count,
    ).toBe(1);
  });

  test('a bottomed card goes to the BOTTOM, not the graveyard', () => {
    const { g, revealed } = activated();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone.kind).toBe('library');
    expect(g.state.zones.library['p1']?.[0]).toBe(top);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = activated();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
