// `Outnumber` — three of mine kill the opponent's 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OUTNUMBER_SCRIPT } from './outnumber';
import { OUTNUMBER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function outnumbered(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Outnumber', 'Grizzly Bears', 'Aysen Bureaucrats', 'Aysen Bureaucrats'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([OUTNUMBER_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p1', 'Aysen Bureaucrats');
  const b = put(g, 'p1', 'Aysen Bureaucrats');
  expect(b).not.toBe(a);
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Outnumber', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Outnumber', () => {
  test('three creatures kill the 2/2', () => {
    const { g, victim } = outnumbered();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OUTNUMBER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OUTNUMBER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OUTNUMBER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = outnumbered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
