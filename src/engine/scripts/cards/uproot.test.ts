// `Uproot` — a LAND on top of its OWNER's library, asserted at the END of
// the array (the library appends; `drawFromTop` takes from there — D253).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UPROOT_SCRIPT } from './uproot';
import { UPROOT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Uproot';
const LAND = 'Mountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function uprooted(): { g: Game; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [LAND, BEARS]],
    scripts: createRegistry([UPROOT_SCRIPT]),
  });
  const land = put(g, 'p2', LAND);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, land, bears };
}

describe('Uproot', () => {
  test("the land goes on TOP of its OWNER's library", () => {
    const { g, land } = uprooted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(land);
    expect(g.state.zones.library['p1']?.includes(land)).toBe(false);
  });

  test('a CREATURE is refused — the noun is "land"', () => {
    const { g, bears } = uprooted();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UPROOT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UPROOT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UPROOT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, land } = uprooted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
