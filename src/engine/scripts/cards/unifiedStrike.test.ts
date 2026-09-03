// `Unified Strike` — with one Soldier on the battlefield the 2-power attacker
// stays; with two it is exiled; a creature at home is refused (D291).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNIFIED_STRIKE_SCRIPT } from './unifiedStrike';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unified Strike';
const BEARS = 'Grizzly Bears';
const SOLDIER_A = 'Thraben Standard Bearer';
const SOLDIER_B = 'Stern Constable';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(soldiers: 1 | 2): { g: Game; att: InstanceId; home: InstanceId } {
  const g = startedGame({ players: 2, decks: [[SPELL, BEARS, BEARS], [SOLDIER_A, SOLDIER_B]], scripts: createRegistry([UNIFIED_STRIKE_SCRIPT]) });
  const att = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  put(g, 'p2', SOLDIER_A);
  if (soldiers === 2) put(g, 'p2', SOLDIER_B);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: att, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, att, home };
}

describe('Unified Strike', () => {
  test('one Soldier: power 2 is more than 1, the attacker stays', () => {
    const { g, att } = aimed(1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: att }] }));
    settle(g);
    expect(g.state.cards[att]?.zone.kind).toBe('battlefield');
  });

  test('two Soldiers: power 2 is at most 2, the attacker is exiled', () => {
    const { g, att } = aimed(2);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: att }] }));
    settle(g);
    expect(g.state.cards[att]?.zone.kind).toBe('exile');
  });

  test('a creature that stayed home is refused (D291)', () => {
    const { g, home } = aimed(2);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, att } = aimed(2);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: att }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
