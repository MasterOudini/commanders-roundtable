// `Cremate` — a card in ANY graveyard is exiled and I draw; a creature on
// the battlefield is not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CREMATE_SCRIPT } from './cremate';
import { CREMATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Cremate';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function aimed(): { g: Game; dead: InstanceId; alive: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, BEARS]],
    scripts: createRegistry([CREMATE_SCRIPT]),
  });
  const dead = put(g, 'p2', BEARS, 'graveyard');
  const alive = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, dead, alive, logAt };
}

describe('Cremate', () => {
  test("the opponent's graveyard card is exiled and I draw", () => {
    const { g, dead, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    expect(g.state.cards[dead]?.zone.kind).toBe('exile');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a creature on the battlefield is refused ("from a graveyard")', () => {
    const { g, alive } = aimed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: alive }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CREMATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CREMATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CREMATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, dead } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
