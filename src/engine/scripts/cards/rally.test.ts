// `Rally` — the blocker gets +1/+1 and survives the 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RALLY_SCRIPT } from './rally';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rallied(): { g: Game; attacker: InstanceId; blocker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rally', 'Aysen Bureaucrats'], ['Aysen Bureaucrats']],
    scripts: createRegistry([RALLY_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Aysen Bureaucrats');
  const blocker = put(g, 'p1', 'Aysen Bureaucrats');
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
  const spell = put(g, 'p1', 'Rally', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, blocker };
}

describe('Rally', () => {
  test('the blocking 1/1 reads 2/2, survives the 1/1, and eats it', () => {
    const { g, attacker, blocker } = rallied();
    expect(derive(g.state, ORACLE, g.deps.scripts, blocker).toughness).toBe(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(g.state.cards[blocker]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[attacker]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = rallied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
