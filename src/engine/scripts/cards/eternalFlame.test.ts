// `Eternal Flame` — three Mountains: 3 at the opponent, ceil(3/2) = 2
// recoil at me.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ETERNAL_FLAME_SCRIPT } from './eternalFlame';
import { ETERNAL_FLAME } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flamed(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Eternal Flame', 'Mountain', 'Mountain', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([ETERNAL_FLAME_SCRIPT]),
  });
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Eternal Flame', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Eternal Flame', () => {
  test('three Mountains: 3 at the opponent, 2 recoil at me', () => {
    const { g } = flamed();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ETERNAL_FLAME.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ETERNAL_FLAME.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ETERNAL_FLAME.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flamed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
