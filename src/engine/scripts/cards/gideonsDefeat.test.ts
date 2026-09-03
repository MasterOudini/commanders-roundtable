// `Gideon's Defeat` - the named targets are accepted and the riders land; a permanent the clause
// excludes is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GIDEONS_DEFEAT_SCRIPT } from './gideonsDefeat';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Gideon's Defeat";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; targets: InstanceId[]; wrong: InstanceId; extras: InstanceId[]; handBefore: Record<'p1' | 'p2', number>; life0: Record<'p1' | 'p2', number> } {
  const g = startedGame({
    players: 2,
    decks: [["Gideon's Defeat", "Thraben Standard Bearer", "Thraben Standard Bearer"], ["Grizzly Bears"]],
    scripts: createRegistry([GIDEONS_DEFEAT_SCRIPT]),
  });
  holdEverywhere(g);
  const targets: InstanceId[] = [];
  targets.push(put(g, 'p1', "Thraben Standard Bearer"));
  const wrong = put(g, 'p1', "Thraben Standard Bearer");
  const extras: InstanceId[] = [];
  settle(g);
  // Turn 3: p1 attacks with the first target, then casts in the response window of combat.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: targets[0] as InstanceId, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const card = put(g, 'p1', CARD, 'hand');
  const handBefore = { p1: (g.state.zones.hand.p1 ?? []).length - 1, p2: (g.state.zones.hand.p2 ?? []).length };
  const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, targets, wrong, extras, handBefore, life0 };
}

describe("Gideon's Defeat", () => {
  test('the named target is accepted and the effect lands', () => {
    const { g, targets, life0 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: targets.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    expect(g.state.cards[targets[0] as InstanceId]?.zone.kind).toBe('exile');
    expect(g.state.players.p1?.life).toBe(life0.p1 + (0));
  });

  test("Thraben Standard Bearer is refused where the clause excludes it (D294)", () => {
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
