// `Sorcerous Sight` — the opponent's whole hand is revealed to me and I
// draw; I am not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SORCEROUS_SIGHT_SCRIPT } from './sorcerousSight';
import { SORCEROUS_SIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Sorcerous Sight';

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

function aimed(): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([SORCEROUS_SIGHT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, logAt };
}

describe('Sorcerous Sight', () => {
  test("the opponent's hand is revealed to me and I draw", () => {
    const { g, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    const hand = g.state.zones.hand['p2'] ?? [];
    expect(hand.length).toBeGreaterThan(0);
    for (const id of hand) expect(g.state.cards[id]?.revealedTo.includes('p1')).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('I am refused as the target ("target opponent")', () => {
    const { g } = aimed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SORCEROUS_SIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SORCEROUS_SIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SORCEROUS_SIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
