// `Delete` — X = 2 kills the 2/2, spares the artifact creature entirely,
// and burns both players.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DELETE_SCRIPT } from './delete';
import { DELETE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function deleted(): { g: Game; bears: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Delete'], ['Grizzly Bears', 'Baleful Strix']],
    scripts: createRegistry([DELETE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Delete', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, bears, strix };
}

describe('Delete', () => {
  test('X = 2: the Bears die, the artifact Strix is exempt, both players take 2', () => {
    const { g, bears, strix } = deleted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[strix]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DELETE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DELETE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DELETE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = deleted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
