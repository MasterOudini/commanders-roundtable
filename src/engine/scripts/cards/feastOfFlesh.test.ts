// `Feast of Flesh` — two dead copies make X = 3: the 2/2 dies and the
// caster gains 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FEAST_OF_FLESH_SCRIPT } from './feastOfFlesh';
import { FEAST_OF_FLESH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function feasted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Feast of Flesh', 'Feast of Flesh', 'Feast of Flesh'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([FEAST_OF_FLESH_SCRIPT]),
  });
  const deadA = put(g, 'p1', 'Feast of Flesh', 'graveyard');
  const deadB = put(g, 'p1', 'Feast of Flesh', 'graveyard');
  expect(deadB).not.toBe(deadA);
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Feast of Flesh', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Feast of Flesh', () => {
  test('two dead copies make X = 3: the 2/2 dies, the caster gains 3', () => {
    const { g, bears } = feasted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FEAST_OF_FLESH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FEAST_OF_FLESH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FEAST_OF_FLESH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = feasted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
