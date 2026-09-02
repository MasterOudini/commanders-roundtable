// `To Arms!` — my two attacking bears untap mid-combat and I draw; they
// still connect.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TO_ARMS_SCRIPT } from './toArms';
import { TO_ARMS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'To Arms!';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

/** Turn 3: both bears attack p2 and are tapped; p1 holds priority in the declare-attackers step. */
function midCombat(): { g: Game; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, BEARS], []],
    scripts: createRegistry([TO_ARMS_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p2' } },
        { card: b, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  // D232's trap: a defender with no creatures is never asked to block — cast
  // in the declare-attackers step, where p1 already holds priority.
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  return { g, a, b };
}

describe('To Arms!', () => {
  test('both attackers untap and I draw; the attack still lands', () => {
    const { g, a, b } = midCombat();
    expect(g.state.cards[a]?.tapped).toBe(true);
    expect(g.state.cards[b]?.tapped).toBe(true);
    const spell = put(g, 'p1', SPELL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(g.state.cards[a]?.tapped).toBe(false);
    expect(g.state.cards[b]?.tapped).toBe(false);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TO_ARMS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TO_ARMS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TO_ARMS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = midCombat();
    const spell = put(g, 'p1', SPELL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
