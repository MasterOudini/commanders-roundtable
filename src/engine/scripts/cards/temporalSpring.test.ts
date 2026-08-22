// `Temporal Spring` — a permanent on TOP of its owner's library, asserted by
// reading the end of the array: the library appends and `drawFromTop` takes
// from the END, so a placement bug is invisible to a zone check alone (D253).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TEMPORAL_SPRING_SCRIPT } from './temporalSpring';
import { TEMPORAL_SPRING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPRING = 'Temporal Spring';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sprung(which: 'creature' | 'land'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPRING], [BEARS, MOUNTAIN]],
    scripts: createRegistry([TEMPORAL_SPRING_SCRIPT]),
  });
  const victim = put(g, 'p2', which === 'creature' ? BEARS : MOUNTAIN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPRING, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Temporal Spring', () => {
  test("a creature goes on TOP of its owner's library", () => {
    const { g, victim } = sprung('creature');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(victim);
  });

  test('a LAND is a legal answer too — the noun is "permanent"', () => {
    const { g, victim } = sprung('land');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(victim);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TEMPORAL_SPRING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TEMPORAL_SPRING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TEMPORAL_SPRING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sprung('land');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
