// `Warpath` — 3 to every blocker and everything they blocked; an UNBLOCKED
// attacker takes nothing, which is the half that separates this from a sweep.
//
// ⚠️ Built on Fight to the Death's harness shape: the OPPONENT attacks and I
// block, so I hold priority in the blockers step and can actually cast. The
// assertions run straight after the resolve, before combat damage would add
// its own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WARPATH_SCRIPT } from './warpath';
import { WARPATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Warpath';
const TITAN = 'Grave Titan'; // 6/6 — survives 3, so the damage is readable

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): { g: Game; blocked: InstanceId; free: InstanceId; blocker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, TITAN],
      [TITAN, TITAN],
    ],
    scripts: createRegistry([WARPATH_SCRIPT]),
  });
  const blocker = put(g, 'p1', TITAN);
  const blocked = put(g, 'p2', TITAN);
  const free = put(g, 'p2', TITAN);
  expect(free).not.toBe(blocked);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: blocked, defender: { kind: 'player', id: 'p1' } },
        { card: free, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(
    g.submit({
      t: 'DeclareBlockers',
      player: 'p1',
      blocks: [{ blocker, attacker: blocked }],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.blockers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, blocked, free, blocker };
}

describe('Warpath', () => {
  test('the blocker and the blocked attacker each take 3', () => {
    const { g, blocked, blocker } = fought();
    expect(g.state.cards[blocked]?.damage).toBe(3);
    expect(g.state.cards[blocker]?.damage).toBe(3);
  });

  test('the UNBLOCKED attacker takes nothing', () => {
    const { g, free } = fought();
    expect(g.state.cards[free]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WARPATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WARPATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WARPATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
