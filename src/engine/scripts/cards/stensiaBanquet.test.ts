// `Stensia Banquet` — damage equal to my Vampire count to the opponent, and
// a card; with no Vampires just the card; I am not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { STENSIA_BANQUET_SCRIPT } from './stensiaBanquet';
import { STENSIA_BANQUET } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Stensia Banquet';
const NIGHTHAWK = 'Vampire Nighthawk';
const CHILD = 'Child of Night';
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

function aimed(board: string[]): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, NIGHTHAWK, CHILD, BEARS], []],
    scripts: createRegistry([STENSIA_BANQUET_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  for (const name of board) put(g, 'p1', name);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, logAt };
}

describe('Stensia Banquet', () => {
  test('two Vampires and a bear: 2 damage to the opponent, and a card', () => {
    const { g, logAt } = aimed([NIGHTHAWK, CHILD, BEARS]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('no Vampires: no damage, still the card', () => {
    const { g, logAt } = aimed([BEARS]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('I am refused as the target ("target opponent or planeswalker")', () => {
    const { g } = aimed([NIGHTHAWK]);
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = STENSIA_BANQUET.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, STENSIA_BANQUET.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(STENSIA_BANQUET.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = aimed([NIGHTHAWK, CHILD]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
