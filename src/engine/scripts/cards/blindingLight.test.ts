// `Blinding Light` — tap all NONWHITE creatures: the green one turns, the
// white one stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLINDING_LIGHT_SCRIPT } from './blindingLight';
import { BLINDING_LIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lit(): { g: Game; green: InstanceId; white: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Blinding Light'], ['Grizzly Bears', 'Angelheart Protector']],
    scripts: createRegistry([BLINDING_LIGHT_SCRIPT]),
  });
  const green = put(g, 'p2', 'Grizzly Bears');
  const white = put(g, 'p2', 'Angelheart Protector');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blinding Light', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, green, white };
}

describe('Blinding Light', () => {
  test('the green creature is tapped; the white one stands', () => {
    const { g, green, white } = lit();
    expect(g.state.cards[green]?.tapped).toBe(true);
    expect(g.state.cards[white]?.tapped).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLINDING_LIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLINDING_LIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLINDING_LIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = lit();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
