// `Banishment Decree` — the widened noun list aims at any of the three
// kinds; the permanent goes on TOP of its OWNER's library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BANISHMENT_DECREE_SCRIPT } from './banishmentDecree';
import { BANISHMENT_DECREE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function decreed(): { g: Game; ring: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Banishment Decree'], ['Sol Ring', 'Mountain']],
    scripts: createRegistry([BANISHMENT_DECREE_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Banishment Decree', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, ring, land };
}

describe('Banishment Decree', () => {
  test("the artifact goes on TOP of its owner's library", () => {
    const { g, ring } = decreed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(ring);
  });

  test('a LAND is refused — the widened list is the enforcement', () => {
    const { g, land } = decreed();
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] });
    expect(verdict.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BANISHMENT_DECREE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BANISHMENT_DECREE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BANISHMENT_DECREE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, ring } = decreed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
