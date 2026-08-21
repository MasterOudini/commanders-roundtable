// `Take Heart` — the pump plus a gain censused off MY declared attackers,
// cast in the attacker's own post-declaration window (Dogpile's idiom).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TAKE_HEART_SCRIPT } from './takeHeart';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** `attack` false casts it in a plain main phase, where nobody is attacking. */
function heartened(attack: boolean): { g: Game; a: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Take Heart', BEARS, BEARS], []],
    scripts: createRegistry([TAKE_HEART_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', BEARS);
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  if (attack) {
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
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
    advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  } else {
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  }
  const spell = put(g, 'p1', 'Take Heart', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a };
}

describe('Take Heart', () => {
  test('the target grows and TWO attackers pay 2 life', () => {
    const { g, a } = heartened(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(4);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('with nobody attacking the pump still lands and the gain is nothing', () => {
    const { g, a } = heartened(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(4);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = heartened(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
