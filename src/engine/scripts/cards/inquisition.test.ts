// `Inquisition` — the hand goes public and only the WHITE cards burn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INQUISITION_SCRIPT } from './inquisition';
import { INQUISITION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function questioned(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Inquisition'],
      ['Aysen Bureaucrats', 'Aysen Bureaucrats', 'Grizzly Bears'],
    ],
    scripts: createRegistry([INQUISITION_SCRIPT]),
  });
  const a = put(g, 'p2', 'Aysen Bureaucrats', 'hand');
  const b = put(g, 'p2', 'Aysen Bureaucrats', 'hand');
  expect(b).not.toBe(a);
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inquisition', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears };
}

describe('Inquisition', () => {
  test('two white cards in the revealed hand deal exactly 2', () => {
    const { g, bears } = questioned();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[bears]?.revealedTo.includes('p1')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INQUISITION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INQUISITION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INQUISITION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = questioned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
