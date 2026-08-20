// `Call to Heel` — the bounce pays ITS CONTROLLER the draw, read before
// the move.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CALL_TO_HEEL_SCRIPT } from './callToHeel';
import { CALL_TO_HEEL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function heeled(): { g: Game; bears: InstanceId; theirBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [['Call to Heel'], ['Grizzly Bears']],
    scripts: createRegistry([CALL_TO_HEEL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const theirBefore = (g.state.zones.hand['p2'] ?? []).length;
  const spell = put(g, 'p1', 'Call to Heel', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, theirBefore };
}

describe('Call to Heel', () => {
  test('the creature goes home and ITS controller draws', () => {
    const { g, bears, theirBefore } = heeled();
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    // Bounced creature + the draw = +2 over their pre-cast hand.
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirBefore + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CALL_TO_HEEL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CALL_TO_HEEL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CALL_TO_HEEL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = heeled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
