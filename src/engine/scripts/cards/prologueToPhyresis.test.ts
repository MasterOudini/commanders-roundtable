// `Prologue to Phyresis` — the opponent gets a poison counter, I get none,
// and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PROLOGUE_TO_PHYRESIS_SCRIPT } from './prologueToPhyresis';
import { PROLOGUE_TO_PHYRESIS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Prologue to Phyresis';

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

function cast(): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([PROLOGUE_TO_PHYRESIS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, logAt };
}

describe('Prologue to Phyresis', () => {
  test('one poison counter for the opponent, none for me, one card for me', () => {
    const { g, logAt } = cast();
    expect(g.state.players['p2']?.poison).toBe(1);
    expect(g.state.players['p1']?.poison).toBe(0);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.log.some((e) => e.body.t === 'PoisonChanged')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PROLOGUE_TO_PHYRESIS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PROLOGUE_TO_PHYRESIS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PROLOGUE_TO_PHYRESIS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
