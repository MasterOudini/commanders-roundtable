// `Mob Justice` — two creatures, two at the player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MOB_JUSTICE_SCRIPT } from './mobJustice';
import { MOB_JUSTICE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function judged(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Mob Justice', 'Grizzly Bears', 'Aysen Bureaucrats'], []],
    scripts: createRegistry([MOB_JUSTICE_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mob Justice', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return g;
}

describe('Mob Justice', () => {
  test('two creatures deal two at the player', () => {
    const g = judged();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MOB_JUSTICE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MOB_JUSTICE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MOB_JUSTICE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = judged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
