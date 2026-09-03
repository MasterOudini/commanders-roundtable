// `Read the Bones` — two cards shown to the scry, two cards drawn after the
// answer, 2 life paid.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { READ_THE_BONES_SCRIPT } from './readTheBones';
import { READ_THE_BONES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Read the Bones';

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

function cast(): { g: Game; logAt: number; shown: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([READ_THE_BONES_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed], toBottom: [] }));
  settle(g);
  return { g, logAt, shown: revealed.length };
}

describe('Read the Bones', () => {
  test('scry 2, then two cards, and 2 life', () => {
    const { g, logAt, shown } = cast();
    expect(shown).toBe(2);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = READ_THE_BONES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, READ_THE_BONES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(READ_THE_BONES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
