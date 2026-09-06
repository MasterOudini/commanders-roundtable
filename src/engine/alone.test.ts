// D341 - "CAN'T ATTACK OR BLOCK ALONE": a restriction on the DECLARATION rather
// than on the creature. The prompt still lists Mogg Flunkies (it may attack
// beside another creature) and requires nothing of it; a declaration naming it
// as the only attacker is refused and named, the same declaration beside a
// Grizzly Bears is accepted; and the block validator asks the same question
// of the only blocker declared.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { MOGG_FLUNKIES_SCRIPT } from './scripts/cards/moggFlunkies';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const at = { kind: 'player', id: 'p2' } as const;

/** p1's Flunkies and Bears, p2's Cyclops; p1 at its third-turn declare-attackers prompt. */
function atDeclare(): { g: Game; flunkies: InstanceId; bears: InstanceId; cyclops: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mogg Flunkies', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([MOGG_FLUNKIES_SCRIPT]),
  });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const flunkies = put(g, 'p1', 'Mogg Flunkies');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 40_000);
  return { g, flunkies, bears, cyclops };
}

describe("D341 - can't attack or block alone", () => {
  test('the prompt lists the creature and requires nothing; it alone is refused by name', () => {
    const { g, flunkies } = atDeclare();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('declareAttackers');
    if (awaiting?.kind === 'declareAttackers') {
      expect(awaiting.attackers).toContain(flunkies);
      expect(awaiting.required).toEqual([]);
    }
    const r = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: flunkies, defender: at }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('illegalAttacker');
      expect(r.message).toContain("can't attack alone");
    }
    expect(g.state.priority.awaiting?.kind).toBe('declareAttackers');
  });

  test('beside the Bears the same creature attacks, and the game replays', () => {
    const { g, flunkies, bears } = atDeclare();
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: flunkies, defender: at }, { card: bears, defender: at }] }));
    expect((g.state.combat?.attackers ?? []).map((a) => a.card).sort()).toEqual([flunkies, bears].sort());
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the only blocker declared may not be one that needs company; two blockers may', () => {
    const { g, flunkies, bears, cyclops } = atDeclare();
    // p1 attacks with nothing; p2's Cyclops comes in on its fourth turn.
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p2', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: cyclops, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    const alone = g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: flunkies, attacker: cyclops }] });
    expect(alone.ok).toBe(false);
    if (!alone.ok) {
      expect(alone.reason).toBe('illegalBlock');
      expect(alone.message).toContain("can't block alone");
    }
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: flunkies, attacker: cyclops }, { blocker: bears, attacker: cyclops }] }));
    expect((g.state.combat?.blockers ?? []).filter((b) => b.attackerOrder.includes(cyclops)).length).toBe(2);
  });
});
