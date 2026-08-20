// `Goblin War Strike` — the damage is my Goblin count, aimed at a player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GOBLIN_WAR_STRIKE_SCRIPT } from './goblinWarStrike';
import { GOBLIN_WAR_STRIKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Goblin War Strike', 'Arms Dealer', 'Arms Dealer', 'Grizzly Bears'], []],
    scripts: createRegistry([GOBLIN_WAR_STRIKE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Arms Dealer');
  const b = put(g, 'p1', 'Arms Dealer');
  expect(b).not.toBe(a);
  put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Goblin War Strike', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Goblin War Strike', () => {
  test('two Goblins and a Bears deal exactly 2', () => {
    const { g } = struck();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GOBLIN_WAR_STRIKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GOBLIN_WAR_STRIKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GOBLIN_WAR_STRIKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struck();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
