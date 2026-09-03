// `Stromgald Cabal` - counters a held spell of the named colour and refuses one of another:
// the adjective is the parser's and the validator's (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STROMGALD_CABAL_SCRIPT } from './stromgaldCabal';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Stromgald Cabal";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: 'right' | 'wrong'): { g: Game; self: InstanceId; spell: InstanceId; stackId: string; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Stromgald Cabal"], ["Thraben Standard Bearer", "Grizzly Bears"]],
    scripts: createRegistry([STROMGALD_CABAL_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const spell = put(g, 'p2', which === 'right' ? "Thraben Standard Bearer" : "Grizzly Bears", 'hand');
  settle(g);
  // p2's main phase on turn 4: past any summoning sickness of the source (CR 302.6).
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  if (which === 'right') {
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 1 }));
    } else {
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    }
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, spell, stackId, life0 };
}

describe("Stromgald Cabal", () => {
  test("the held Thraben Standard Bearer is a legal target and is countered", () => {
    const { g, self, spell, stackId, life0 } = armed('right');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.stack.length).toBe(0);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
  });

  test("a held Grizzly Bears is refused (D294)", () => {
    const { g, stackId } = armed('wrong');
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, stackId } = armed('right');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
