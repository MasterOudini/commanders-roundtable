// D338 - THE DEFENDER'S BOARD (CR 508.1c): "Sea Monster can't attack unless
// defending player controls an Island." A restriction that reads the DEFENDER
// is asked of each attacker/defender pair at the declaration: the prompt still
// lists the creature (it may attack someone else), the declaration at a player
// without an Island is refused and named, the same declaration is accepted
// once that player controls one, and at a three-player table each defender's
// board is read on its own.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { SEA_MONSTER_SCRIPT } from './scripts/cards/seaMonster';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const at = (id: 'p2' | 'p3') => ({ kind: 'player', id }) as const;

/** p1's Sea Monster at its third-turn declare-attackers prompt; nobody controls an Island yet. */
function atDeclare(players: 2 | 3): { g: Game; monster: InstanceId } {
  const g = startedGame({
    players,
    decks: players === 2 ? [['Sea Monster'], ['Cyclops of One-Eyed Pass', 'Island']] : [['Sea Monster'], ['Cyclops of One-Eyed Pass', 'Island'], ['Grizzly Bears', 'Island']],
    scripts: createRegistry([SEA_MONSTER_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const monster = put(g, 'p1', 'Sea Monster');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === (players === 2 ? 3 : 4) && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 40_000);
  return { g, monster };
}

describe("D338 - can't attack unless defending player controls", () => {
  test('the prompt lists the creature and requires nothing; the declaration at a player without an Island is refused by name', () => {
    const { g, monster } = atDeclare(2);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('declareAttackers');
    if (awaiting?.kind === 'declareAttackers') {
      expect(awaiting.attackers).toContain(monster);
      expect(awaiting.required).toEqual([]);
    }
    const r = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: monster, defender: at('p2') }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('illegalAttacker');
      expect(r.message).toContain("can't attack that defender");
    }
    expect(g.state.priority.awaiting?.kind).toBe('declareAttackers');
  });

  test('the same declaration is accepted once that player controls an Island', () => {
    const { g, monster } = atDeclare(2);
    put(g, 'p2', 'Island');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: monster, defender: at('p2') }] }));
    expect((g.state.combat?.attackers ?? []).map((a) => a.card)).toEqual([monster]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("at a three-player table each defender's board is read on its own", () => {
    const { g, monster } = atDeclare(3);
    put(g, 'p3', 'Island');
    const refused = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: monster, defender: at('p2') }] });
    expect(refused.ok).toBe(false);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: monster, defender: at('p3') }] }));
    expect((g.state.combat?.attackers ?? []).map((a) => a.defender)).toEqual([at('p3')]);
  });
});
