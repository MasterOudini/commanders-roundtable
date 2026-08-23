// `Trapfinder's Trick` — the Trap goes, its neighbour stays, and nothing is
// ever asked.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRAPFINDERS_TRICK_SCRIPT } from './trapfindersTrick';
import { TRAPFINDER_S_TRICK, PITFALL_TRAP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Trapfinder's Trick";
const TRAP = 'Pitfall Trap';
const PLAIN = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sprung(victim: 'p1' | 'p2'): { g: Game; trap: InstanceId; plain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, TRAP, PLAIN], [TRAP, PLAIN]],
    scripts: createRegistry([TRAPFINDERS_TRICK_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const trap = put(g, victim, TRAP, 'hand');
  const plain = put(g, victim, PLAIN, 'hand');
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: victim }] }));
  settle(g);
  return { g, trap, plain };
}

describe("Trapfinder's Trick", () => {
  test("the opponent's Trap is discarded and the rest of the hand stays", () => {
    const { g, trap, plain } = sprung('p2');
    expect(g.state.cards[trap]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[plain]?.zone.kind).toBe('hand');
  });

  test('the discard is CHOICELESS — no prompt, however many Traps (CR 701.8a)', () => {
    const { g } = sprung('p2');
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('it can be aimed at MYSELF — the clause is "target player"', () => {
    const { g, trap } = sprung('p1');
    expect(g.state.cards[trap]?.zone.kind).toBe('graveyard');
  });

  test('the subtype is what decides it, not the card type', () => {
    // Pitfall Trap is an Instant AND a Trap; Grizzly Bears is neither.
    expect(PITFALL_TRAP.faces[0]?.typeLine ?? '').toContain('Trap');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRAPFINDER_S_TRICK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRAPFINDER_S_TRICK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRAPFINDER_S_TRICK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sprung('p2');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
