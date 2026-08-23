// `Time Ebb` — a creature on TOP of its owner's library, asserted at the END
// of the array: the library appends and `drawFromTop` takes from the end, so
// a placement bug is invisible to a zone check alone (D253).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TIME_EBB_SCRIPT } from './timeEbb';
import { TIME_EBB } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Time Ebb';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ebbed(): { g: Game; bears: InstanceId; mountain: InstanceId; spell: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, MOUNTAIN]],
    scripts: createRegistry([TIME_EBB_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const mountain = put(g, 'p2', MOUNTAIN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, mountain, spell };
}

describe('Time Ebb', () => {
  test("the creature goes on TOP of its OWNER's library", () => {
    const { g, bears } = ebbed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(bears);
    expect(g.state.zones.library['p1']?.includes(bears)).toBe(false);
  });

  test('a LAND is refused — the noun is "creature", not "permanent"', () => {
    const { g, mountain } = ebbed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] });
    expect(res.ok).toBe(false);
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TIME_EBB.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TIME_EBB.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TIME_EBB.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears } = ebbed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
