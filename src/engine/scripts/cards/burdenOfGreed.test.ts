// `Burden of Greed` — 1 per TAPPED artifact: one tapped, one upright pays 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BURDEN_OF_GREED_SCRIPT } from './burdenOfGreed';
import { BURDEN_OF_GREED } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burdened(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Burden of Greed'], ['Sol Ring', 'Sol Ring']],
    scripts: createRegistry([BURDEN_OF_GREED_SCRIPT]),
  });
  const tapped = put(g, 'p2', 'Sol Ring');
  put(g, 'p2', 'Sol Ring');
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [tapped], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Burden of Greed', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Burden of Greed', () => {
  test('one tapped + one upright artifact pays exactly 1', () => {
    const g = burdened();
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BURDEN_OF_GREED.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BURDEN_OF_GREED.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BURDEN_OF_GREED.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = burdened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
