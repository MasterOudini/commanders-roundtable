// `Nature's Ruin` — my own green Bears dies too; the white bystander
// stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NATURES_RUIN_SCRIPT } from './naturesRuin';
import { NATURE_S_RUIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruined(): { g: Game; mine: InstanceId; white: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Nature's Ruin", 'Grizzly Bears'], ['Aysen Bureaucrats']],
    scripts: createRegistry([NATURES_RUIN_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const white = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Nature's Ruin", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, white };
}

describe("Nature's Ruin", () => {
  test('my own green dies; the white bystander stands', () => {
    const { g, mine, white } = ruined();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[white]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NATURE_S_RUIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NATURE_S_RUIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NATURE_S_RUIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ruined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
