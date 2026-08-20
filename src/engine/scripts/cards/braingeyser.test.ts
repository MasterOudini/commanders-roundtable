// `Braingeyser` — the TARGET draws X: X=3 at the opponent fills THEIR hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BRAINGEYSER_SCRIPT } from './braingeyser';
import { BRAINGEYSER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function geysered(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Braingeyser'], ['Grizzly Bears']],
    scripts: createRegistry([BRAINGEYSER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const before = (g.state.zones.hand['p2'] ?? []).length;
  const spell = put(g, 'p1', 'Braingeyser', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, before };
}

describe('Braingeyser', () => {
  test('X=3 at the opponent draws THEM three', () => {
    const { g, before } = geysered();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BRAINGEYSER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BRAINGEYSER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BRAINGEYSER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = geysered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
