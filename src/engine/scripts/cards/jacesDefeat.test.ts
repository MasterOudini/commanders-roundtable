// `Jace's Defeat` - counters a held spell the adjective admits and refuses one it excludes (D294).
// Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JACES_DEFEAT_SCRIPT } from './jacesDefeat';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Jace's Defeat";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: 'right' | 'wrong'): { g: Game; spell: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[CARD], ["Merfolk of the Pearl Trident", "Grizzly Bears"]],
    scripts: createRegistry([JACES_DEFEAT_SCRIPT]),
  });
  holdEverywhere(g);
  const mine = put(g, 'p1', CARD, 'hand');
  const spell = put(g, 'p2', which === 'right' ? "Merfolk of the Pearl Trident" : "Grizzly Bears", 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  if (which === 'right') {
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 1 }));
  } else {
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, stackId };
}

describe("Jace's Defeat", () => {
  test("the held Merfolk of the Pearl Trident is a legal target and is countered", () => {
    const { g, spell, stackId } = armed('right');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.stack.length).toBe(0);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test("a held Grizzly Bears is refused (D294)", () => {
    const { g, stackId } = armed('wrong');
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, stackId } = armed('right');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
