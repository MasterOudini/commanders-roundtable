// `Friendly Rivalry` - the named targets are accepted and the riders land; a permanent the clause
// excludes is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FRIENDLY_RIVALRY_SCRIPT } from './friendlyRivalry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Friendly Rivalry";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; targets: InstanceId[]; wrong: InstanceId; extras: InstanceId[]; handBefore: Record<'p1' | 'p2', number>; life0: Record<'p1' | 'p2', number> } {
  const g = startedGame({
    players: 2,
    decks: [["Friendly Rivalry", "Grizzly Bears", "Lady Caleria", "Grizzly Bears"], ["Vampire Nighthawk"]],
    scripts: createRegistry([FRIENDLY_RIVALRY_SCRIPT]),
  });
  holdEverywhere(g);
  const targets: InstanceId[] = [];
  targets.push(put(g, 'p1', "Grizzly Bears"));
  targets.push(put(g, 'p1', "Lady Caleria"));
  targets.push(put(g, 'p2', "Vampire Nighthawk"));
  const wrong = put(g, 'p1', "Grizzly Bears");
  const extras: InstanceId[] = [];
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', CARD, 'hand');
  const handBefore = { p1: (g.state.zones.hand.p1 ?? []).length - 1, p2: (g.state.zones.hand.p2 ?? []).length };
  const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, targets, wrong, extras, handBefore, life0 };
}

describe("Friendly Rivalry", () => {
  test('the named targets are accepted and the effect lands', () => {
    const { g, targets } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: targets.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    expect(g.state.cards[targets[2] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test("Grizzly Bears is refused where the clause excludes it (D294)", () => {
    const { g, targets, wrong } = armed();
    const aimed = targets.slice();
    aimed[1] = wrong;
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: aimed.map((id) => ({ kind: 'card' as const, id })) }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, targets } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: targets.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
