// `Wrack with Madness` — a creature hits ITSELF for its own power. A 6/6
// survives its own 6 as damage (it is not lethal until SBA compares, and 6
// damage on 6 toughness IS lethal) — so the test uses a 2/2, which dies, and
// a 0-power body, which does nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WRACK_WITH_MADNESS_SCRIPT } from './wrackWithMadness';
import { WRACK_WITH_MADNESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wrack with Madness';
const BEARS = 'Grizzly Bears'; // 2/2 — 2 damage on 2 toughness is lethal
const WALL = 'Wall of Runes'; // 0/4 — zero power, so it takes nothing

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([WRACK_WITH_MADNESS_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Wrack with Madness', () => {
  test('a 2/2 kills itself', () => {
    const { g, victim } = cast(BEARS);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a ZERO-power creature takes nothing and lives', () => {
    const { g, victim } = cast(WALL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[victim]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WRACK_WITH_MADNESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WRACK_WITH_MADNESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WRACK_WITH_MADNESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(BEARS);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
