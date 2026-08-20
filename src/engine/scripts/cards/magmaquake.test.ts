// `Magmaquake` — X = 2: the grounded 2/2 dies, the flyer is exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MAGMAQUAKE_SCRIPT } from './magmaquake';
import { MAGMAQUAKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quaked(): { g: Game; bears: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Magmaquake'], ['Grizzly Bears', 'Baleful Strix']],
    scripts: createRegistry([MAGMAQUAKE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Magmaquake', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, bears, strix };
}

describe('Magmaquake', () => {
  test('X = 2: the grounded 2/2 dies, the flyer is exempt and unmarked', () => {
    const { g, bears, strix } = quaked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[strix]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[strix]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MAGMAQUAKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MAGMAQUAKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MAGMAQUAKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = quaked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
