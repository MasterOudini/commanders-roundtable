// `Stronghold Biologist` — two blue, the tap and a discarded card counter
// the opponent's creature spell held on the stack (turn 4: their second
// turn, the Biologist past summoning sickness).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRONGHOLD_BIOLOGIST_SCRIPT } from './strongholdBiologist';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BIOLOGIST = 'Stronghold Biologist';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function held(): { g: Game; biologist: InstanceId; bears: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[BIOLOGIST], [BEARS]],
    scripts: createRegistry([STRONGHOLD_BIOLOGIST_SCRIPT]),
  });
  holdEverywhere(g);
  const biologist = put(g, 'p1', BIOLOGIST);
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
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  return { g, biologist, bears, stackId };
}

describe('Stronghold Biologist', () => {
  test('{U}{U}, {T}, discard a card: the creature spell is countered', () => {
    const { g, biologist, bears, stackId } = held();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: biologist, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, biologist, stackId } = held();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: biologist, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
