// `Disarm` — both Equipment fall off the target; the Aura on the same
// creature stays put.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DISARM_SCRIPT } from './disarm';
import { DISARM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function disarmed(): { g: Game; a: InstanceId; b: InstanceId; aura: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Disarm'],
      ['Grizzly Bears', 'Lightning Greaves', 'Lightning Greaves', 'Pacifism'],
    ],
    scripts: createRegistry([DISARM_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const a = put(g, 'p2', 'Lightning Greaves');
  const b = put(g, 'p2', 'Lightning Greaves');
  expect(b).not.toBe(a);
  const aura = put(g, 'p2', 'Pacifism');
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: a, to: bears }));
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: b, to: bears }));
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: aura, to: bears }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Disarm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, a, b, aura };
}

describe('Disarm', () => {
  test('both Equipment unattach; the Aura stays', () => {
    const { g, a, b, aura } = disarmed();
    expect(g.state.cards[a]?.attachedTo).toBeNull();
    expect(g.state.cards[b]?.attachedTo).toBeNull();
    expect(g.state.cards[aura]?.attachedTo).not.toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DISARM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DISARM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DISARM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = disarmed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
