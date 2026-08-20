// `Consuming Corruption` — X = my Swamps: two Swamps kill a 2/2 and pay 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONSUMING_CORRUPTION_SCRIPT } from './consumingCorruption';
import { CONSUMING_CORRUPTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function corrupted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Consuming Corruption', 'Swamp', 'Swamp'], ['Grizzly Bears']],
    scripts: createRegistry([CONSUMING_CORRUPTION_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Swamp');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Consuming Corruption', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Consuming Corruption', () => {
  test('two Swamps: the 2/2 dies of 2 and the caster gains 2', () => {
    const { g, bears } = corrupted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONSUMING_CORRUPTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONSUMING_CORRUPTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONSUMING_CORRUPTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = corrupted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
