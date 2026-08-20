// `Piety` — the blocker gains +0/+3 and survives; a bystander gets
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PIETY_SCRIPT } from './piety';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pious(): { g: Game; attacker: InstanceId; blocker: InstanceId; spare: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Piety', 'Aysen Bureaucrats', 'Aysen Bureaucrats'], ['Grizzly Bears']],
    scripts: createRegistry([PIETY_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Grizzly Bears');
  const blocker = put(g, 'p1', 'Aysen Bureaucrats');
  const spare = put(g, 'p1', 'Aysen Bureaucrats');
  expect(spare).not.toBe(blocker);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p1' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker, attacker }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.blockers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Piety', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, blocker, spare };
}

describe('Piety', () => {
  test('the blocker reads 1/4 and survives the 2/2; the bystander stays 1/1', () => {
    const { g, attacker, blocker, spare } = pious();
    expect(derive(g.state, ORACLE, g.deps.scripts, blocker).toughness).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, spare).toughness).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(g.state.cards[blocker]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[attacker]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = pious();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
