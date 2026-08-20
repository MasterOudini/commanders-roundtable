// `Morale` — both attackers get +1/+1; the defender takes 2+2 for 3+1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MORALE_SCRIPT } from './morale';
import { MORALE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rallied(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Morale', 'Grizzly Bears', 'Aysen Bureaucrats'], []],
    scripts: createRegistry([MORALE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const clerk = put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: bears, defender: { kind: 'player', id: 'p2' } },
        { card: clerk, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  advanceUntil(
    g,
    (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0,
    20_000,
  );
  const spell = put(g, 'p1', 'Morale', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Morale', () => {
  test('the pumped pair connects for 3+2', () => {
    const g = rallied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    // The 2/2 Bears hits for 3 and the 1/1 Bureaucrats for 2.
    expect(g.state.players['p2']?.life).toBe(35);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MORALE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MORALE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MORALE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = rallied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
