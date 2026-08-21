// `Strip Bare` — the worn Equipment dies; a spare one lying loose on the
// battlefield does not. The Boots are CAST-free here: `ManualAttach` is
// what puts them on, which is the Tier-3 tool the D96 aim commits.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRIP_BARE_SCRIPT } from './stripBare';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stripped(): { g: Game; worn: InstanceId; spare: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Strip Bare'], ['Grizzly Bears', 'Swiftfoot Boots', 'Swiftfoot Boots']],
    scripts: createRegistry([STRIP_BARE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const worn = put(g, 'p2', 'Swiftfoot Boots');
  const spare = put(g, 'p2', 'Swiftfoot Boots');
  if (worn === spare) throw new Error('the deck must hold two distinct Boots');
  settle(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: worn, to: bears }));
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Strip Bare', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, worn, spare, bears };
}

describe('Strip Bare', () => {
  test('the worn Equipment dies; the spare and the host stand', () => {
    const { g, worn, spare, bears } = stripped();
    expect(g.state.cards[worn]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[spare]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = stripped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
