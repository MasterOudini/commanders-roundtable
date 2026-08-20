// `Hibernation` — every GREEN permanent goes home, mine included; the
// blue-black flyer stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HIBERNATION_SCRIPT } from './hibernation';
import { HIBERNATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slept(): { g: Game; herder: InstanceId; bears: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hibernation', 'Elvish Herder'], ['Grizzly Bears', 'Baleful Strix']],
    scripts: createRegistry([HIBERNATION_SCRIPT]),
  });
  const herder = put(g, 'p1', 'Elvish Herder');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hibernation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, herder, bears, strix };
}

describe('Hibernation', () => {
  test('both green creatures go to their OWNERS hands; the Strix stays', () => {
    const { g, herder, bears, strix } = slept();
    expect((g.state.zones.hand['p1'] ?? []).includes(herder)).toBe(true);
    expect((g.state.zones.hand['p2'] ?? []).includes(bears)).toBe(true);
    expect(g.state.cards[strix]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HIBERNATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HIBERNATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HIBERNATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = slept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
