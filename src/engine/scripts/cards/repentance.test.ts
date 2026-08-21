// `Repentance` — the fourth id of the self-bite text: a 6/6 dies to its
// own six.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REPENTANCE_SCRIPT } from './repentance';
import { REPENTANCE, INNER_STRUGGLE } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function repented(): { g: Game; dreadmaw: string } {
  const g = startedGame({
    players: 2,
    decks: [['Repentance'], ['Colossal Dreadmaw']],
    scripts: createRegistry([REPENTANCE_SCRIPT]),
  });
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Repentance', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: dreadmaw }] }),
  );
  settle(g);
  return { g, dreadmaw };
}

describe('Repentance', () => {
  test('shares its printed text with Inner Struggle', () => {
    expect(REPENTANCE.faces[0]?.oracleText).toBe(INNER_STRUGGLE.faces[0]?.oracleText);
  });

  test('the 6/6 dies to its own power', () => {
    const { g, dreadmaw } = repented();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = repented();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
