// `Overwhelming Intellect` — counters the creature spell and draws its
// mana value.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OVERWHELMING_INTELLECT_SCRIPT } from './overwhelmingIntellect';
import { OVERWHELMING_INTELLECT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function intellected(): { g: Game; bears: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Overwhelming Intellect'], ['Grizzly Bears']],
    scripts: createRegistry([OVERWHELMING_INTELLECT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack[g.state.stack.length - 1]?.id;
  if (!stackId) throw new Error('no spell on the stack');
  const spell = put(g, 'p1', 'Overwhelming Intellect', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  const mid = (g.state.zones.hand['p1'] ?? []).length - 1; // the spell leaves on cast
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'stack', id: stackId }],
    }),
  );
  settle(g);
  return { g, bears, mid };
}

describe('Overwhelming Intellect', () => {
  test('counters the mv-2 Bears and draws two', () => {
    const { g, bears, mid } = intellected();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OVERWHELMING_INTELLECT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OVERWHELMING_INTELLECT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OVERWHELMING_INTELLECT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = intellected();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
