// `Topple the Statue` — an artifact target is tapped and destroyed; a
// creature target is only tapped; a card either way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TOPPLE_THE_STATUE_SCRIPT } from './toppleTheStatue';
import { TOPPLE_THE_STATUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Topple the Statue';
const STAFF = 'Staff of Nin';
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

function aimed(): { g: Game; staff: InstanceId; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [STAFF, BEARS]],
    scripts: createRegistry([TOPPLE_THE_STATUE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const staff = put(g, 'p2', STAFF);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, staff, bears, logAt };
}

describe('Topple the Statue', () => {
  test('an artifact: tapped, destroyed, and a card', () => {
    const { g, staff, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone.kind).toBe('graveyard');
    expect(g.log.slice(logAt).some((e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(staff))).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a creature: tapped, kept, and a card', () => {
    const { g, bears, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TOPPLE_THE_STATUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TOPPLE_THE_STATUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TOPPLE_THE_STATUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, staff } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
