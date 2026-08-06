// `Ertai, the Corrupted` — the OR chooser pays for the counter: a creature
// pays, an enchantment pays, a land does not, and the held spell dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ERTAI_THE_CORRUPTED_SCRIPT } from './ertaiTheCorrupted';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ERTAI = 'Ertai, the Corrupted';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; ertai: InstanceId; spare: InstanceId; land: InstanceId; bears: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[ERTAI, BEARS, MOUNTAIN], [BEARS]],
    scripts: createRegistry([ERTAI_THE_CORRUPTED_SCRIPT]),
  });
  holdEverywhere(g);
  const ertai = put(g, 'p1', ERTAI);
  const spare = put(g, 'p1', BEARS);
  const land = put(g, 'p1', MOUNTAIN);
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
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const stackId = g.state.stack[0]?.id as string;
  return { g, ertai, spare, land, bears, stackId };
}

describe('Ertai, the Corrupted', () => {
  test('a creature pays the OR cost and the held spell is countered', () => {
    const { g, ertai, spare, bears, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ertai, abilityIndex: 0, sacrifice: spare }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    expect(g.state.cards[spare]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
    expect(g.state.cards[ertai]?.zone.kind).toBe('battlefield');
  });

  test('a LAND is neither arm of "a creature or enchantment"', () => {
    const { g, ertai, land } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: ertai, abilityIndex: 0, sacrifice: land });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, ertai, spare, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ertai, abilityIndex: 0, sacrifice: spare }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
