// `Corrupted Resolve` — the CONDITIONAL counter: a poisoned caster's spell
// dies, a clean one's resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CORRUPTED_RESOLVE_SCRIPT } from './corruptedResolve';
import { CORRUPTED_RESOLVE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function countered(poisoned: boolean): { g: Game; spell: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Corrupted Resolve'], ['Grizzly Bears']],
    scripts: createRegistry([CORRUPTED_RESOLVE_SCRIPT]),
  });
  if (poisoned) {
    must(g.submit({ t: 'ManualSetPoison', player: 'p2', target: 'p2', delta: 2 }));
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  const counter = put(g, 'p1', 'Corrupted Resolve', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, spell };
}

describe('Corrupted Resolve', () => {
  test("a POISONED caster's spell is countered", () => {
    const { g, spell } = countered(true);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test("a clean caster's spell resolves — the condition is real", () => {
    const { g, spell } = countered(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CORRUPTED_RESOLVE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CORRUPTED_RESOLVE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CORRUPTED_RESOLVE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = countered(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
