// `Muscle Burst` — one namesake buried makes it +4/+4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MUSCLE_BURST_SCRIPT } from './muscleBurst';
import { MUSCLE_BURST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bursted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Muscle Burst', 'Muscle Burst', 'Grizzly Bears'], []],
    scripts: createRegistry([MUSCLE_BURST_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const buried = put(g, 'p1', 'Muscle Burst', 'hand');
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: buried,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  const spell = put(g, 'p1', 'Muscle Burst', 'hand');
  expect(spell).not.toBe(buried);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Muscle Burst', () => {
  test('3 + one namesake makes the Bears 6/6', () => {
    const { g, bears } = bursted();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(6);
    expect(d.toughness).toBe(6);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MUSCLE_BURST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MUSCLE_BURST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MUSCLE_BURST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bursted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
