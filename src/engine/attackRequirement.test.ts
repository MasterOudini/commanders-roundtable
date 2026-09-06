// D335 - THE ATTACK REQUIREMENT (CR 508.1d): "attacks each combat if able" is
// the first combat REQUIREMENT beside the restrictions. The declare-attackers
// prompt names the creatures a declaration must include; a declaration that
// leaves one of them home is refused; a creature that could not attack anyway
// (summoning sick here) is not required, because a requirement never asks for
// an illegal attack. Proven on Goblin Brigand, a generated row; every generated
// must-attack suite proves its own card the same way.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { GOBLIN_BRIGAND_SCRIPT } from './scripts/cards/goblinBrigand';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

const P2 = { kind: 'player', id: 'p2' } as const;

/**
 * p1 at its third-turn declare-attackers prompt with Grizzly Bears and Goblin
 * Brigand out. `sick` puts the Brigand out this turn; `tapped` taps it first.
 */
function atDeclare(how: 'ready' | 'sick' | 'tapped'): { g: Game; self: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Goblin Brigand', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([GOBLIN_BRIGAND_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  let self: InstanceId | undefined;
  if (how !== 'sick') {
    self = put(g, 'p1', 'Goblin Brigand');
    settle(g);
  }
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (how === 'sick') {
    self = put(g, 'p1', 'Goblin Brigand');
    settle(g);
  }
  if (self === undefined) throw new Error('no Brigand');
  if (how === 'tapped') must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: true }));
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, self, bears };
}

describe('D335 - the attack requirement', () => {
  test('the prompt names the required attacker, and an empty declaration is refused for it', () => {
    const { g, self } = atDeclare('ready');
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('declareAttackers');
    if (awaiting?.kind === 'declareAttackers') {
      expect(awaiting.required).toEqual([self]);
      expect(awaiting.attackers).toContain(self);
    }
    const r = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('attackRequired');
    // Refused means nothing moved: the prompt still stands.
    expect(g.state.priority.awaiting?.kind).toBe('declareAttackers');
  });

  test('a declaration that leaves the required creature home is refused; one that brings it is accepted', () => {
    const { g, self, bears } = atDeclare('ready');
    const r = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: P2 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('attackRequired');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: P2 }, { card: self, defender: P2 }] }));
    const attacking = (g.state.combat?.attackers ?? []).map((a) => a.card);
    expect(attacking).toHaveLength(2);
    expect(attacking).toContain(self);
    expect(attacking).toContain(bears);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test.each(['sick', 'tapped'] as const)('a must-attacker that cannot attack (%s) is not required: the empty declaration stands', (how) => {
    const { g, self } = atDeclare(how);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('declareAttackers');
    if (awaiting?.kind === 'declareAttackers') {
      expect(awaiting.required).toEqual([]);
      expect(awaiting.attackers).not.toContain(self);
    }
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }));
    expect(g.state.combat?.attackers ?? []).toHaveLength(0);
  });
});
