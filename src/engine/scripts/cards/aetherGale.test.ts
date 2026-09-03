// `Aether Gale` - the named targets are accepted and the riders land; a permanent the clause
// excludes is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AETHER_GALE_SCRIPT } from './aetherGale';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Aether Gale";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; targets: InstanceId[]; wrong: InstanceId; extras: InstanceId[]; handBefore: Record<'p1' | 'p2', number>; life0: Record<'p1' | 'p2', number> } {
  const g = startedGame({
    players: 2,
    decks: [["Aether Gale"], ["Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Forest"]],
    scripts: createRegistry([AETHER_GALE_SCRIPT]),
  });
  holdEverywhere(g);
  const targets: InstanceId[] = [];
  targets.push(put(g, 'p2', "Grizzly Bears"));
  targets.push(put(g, 'p2', "Grizzly Bears"));
  targets.push(put(g, 'p2', "Grizzly Bears"));
  targets.push(put(g, 'p2', "Grizzly Bears"));
  targets.push(put(g, 'p2', "Grizzly Bears"));
  targets.push(put(g, 'p2', "Grizzly Bears"));
  const wrong = put(g, 'p2', "Forest");
  const extras: InstanceId[] = [];
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', CARD, 'hand');
  const handBefore = { p1: (g.state.zones.hand.p1 ?? []).length - 1, p2: (g.state.zones.hand.p2 ?? []).length };
  const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, targets, wrong, extras, handBefore, life0 };
}

describe("Aether Gale", () => {
  test('the named targets are accepted and the effect lands', () => {
    const { g, targets } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: targets.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    expect(g.state.cards[targets[0] as InstanceId]?.zone.kind).toBe('hand');
    expect(g.state.cards[targets[5] as InstanceId]?.zone.kind).toBe('hand');
  });

  test("Forest is refused where the clause excludes it (D294)", () => {
    const { g, targets, wrong } = armed();
    const aimed = targets.slice();
    aimed[0] = wrong;
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
