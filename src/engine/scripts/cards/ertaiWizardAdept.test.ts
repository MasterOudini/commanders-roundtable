// `Ertai, Wizard Adept` — counters the held spell and stays standing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ERTAI_WIZARD_ADEPT_SCRIPT } from './ertaiWizardAdept';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ERTAI = 'Ertai, Wizard Adept';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; ertai: InstanceId; bears: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[ERTAI], [BEARS]],
    scripts: createRegistry([ERTAI_WIZARD_ADEPT_SCRIPT]),
  });
  holdEverywhere(g);
  const ertai = put(g, 'p1', ERTAI);
  const bears = put(g, 'p2', BEARS, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const stackId = g.state.stack[0]?.id as string;
  return { g, ertai, bears, stackId };
}

describe('Ertai, Wizard Adept', () => {
  test('counters the held spell with Ertai still on the battlefield', () => {
    const { g, ertai, bears, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ertai, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
    expect(g.state.cards[ertai]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ertai]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, ertai, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ertai, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
