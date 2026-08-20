// `Hint of Insanity` — the reveal is public, then the name census: the
// Bears pair goes, the Swamp pair STAYS (lands), the singleton stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HINT_OF_INSANITY_SCRIPT } from './hintOfInsanity';
import { HINT_OF_INSANITY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hinted(): {
  g: Game;
  bearA: InstanceId;
  bearB: InstanceId;
  swampA: InstanceId;
  swampB: InstanceId;
  herder: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Hint of Insanity'],
      ['Grizzly Bears', 'Grizzly Bears', 'Swamp', 'Swamp', 'Elvish Herder'],
    ],
    scripts: createRegistry([HINT_OF_INSANITY_SCRIPT]),
  });
  const bearA = put(g, 'p2', 'Grizzly Bears', 'hand');
  const bearB = put(g, 'p2', 'Grizzly Bears', 'hand');
  expect(bearB).not.toBe(bearA);
  const swampA = put(g, 'p2', 'Swamp', 'hand');
  const swampB = put(g, 'p2', 'Swamp', 'hand');
  expect(swampB).not.toBe(swampA);
  const herder = put(g, 'p2', 'Elvish Herder', 'hand');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hint of Insanity', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bearA, bearB, swampA, swampB, herder };
}

describe('Hint of Insanity', () => {
  test('the nonland name-pair discards; land pairs and singletons stay, revealed', () => {
    const { g, bearA, bearB, swampA, swampB, herder } = hinted();
    expect(g.state.cards[bearA]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bearB]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p2'] ?? []).includes(swampA)).toBe(true);
    expect((g.state.zones.hand['p2'] ?? []).includes(swampB)).toBe(true);
    expect((g.state.zones.hand['p2'] ?? []).includes(herder)).toBe(true);
    expect(g.state.cards[herder]?.revealedTo.includes('p1')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HINT_OF_INSANITY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HINT_OF_INSANITY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HINT_OF_INSANITY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hinted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
