// `Leadership Vacuum` — the opponent's commander, once on the battlefield,
// goes back to the command zone; my own commander stays; I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LEADERSHIP_VACUUM_SCRIPT } from './leadershipVacuum';
import { LEADERSHIP_VACUUM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Leadership Vacuum';

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

/** Both commanders on the battlefield (moved out of the command zone by hand), then the spell aimed at p2. */
function vacuumed(): { g: Game; mine: InstanceId; theirs: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([LEADERSHIP_VACUUM_SCRIPT]),
  });
  const mine = g.state.players['p1']?.commanderIds[0] as InstanceId;
  const theirs = g.state.players['p2']?.commanderIds[0] as InstanceId;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mine, to: { kind: 'battlefield', player: 'p1' } }));
  must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
  settle(g);
  expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mine, theirs, logAt };
}

describe('Leadership Vacuum', () => {
  test("the opponent's commander goes home; mine stays; I draw", () => {
    const { g, mine, theirs, logAt } = vacuumed();
    expect(g.state.cards[theirs]?.zone.kind).toBe('command');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LEADERSHIP_VACUUM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LEADERSHIP_VACUUM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LEADERSHIP_VACUUM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = vacuumed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
