// `Molten Vortex` — the TYPED discard chooser: a land card from my hand pays,
// a creature card does not; 2 damage to the opponent, or to a creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { MOLTEN_VORTEX_SCRIPT } from './moltenVortex';
import { advanceUntil, deps, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VORTEX = 'Molten Vortex';
const ISLAND = 'Island';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function offered(g: Game, card: InstanceId): boolean {
  const d = deps(createRegistry([MOLTEN_VORTEX_SCRIPT]));
  return legalActions(g.state, d.oracle, d.scripts, 'p1').some(
    (a) => a.t === 'ActivateAbility' && a.card === card && a.abilityIndex === 0,
  );
}

/** My hand holds ONLY an Island and a Grizzly Bears; the opponent has a bear out. */
function placed(): { g: Game; vortex: InstanceId; island: InstanceId; bearsInHand: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VORTEX, ISLAND, BEARS], [BEARS]],
    scripts: createRegistry([MOLTEN_VORTEX_SCRIPT]),
  });
  holdEverywhere(g);
  for (const id of idsIn(g, 'p1', 'hand')) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
  }
  const vortex = put(g, 'p1', VORTEX);
  const island = put(g, 'p1', ISLAND, 'hand');
  const bearsInHand = put(g, 'p1', BEARS, 'hand');
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  // Re-anchor: my main phase with priority and no ask up (a settle can step the turn).
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  return { g, vortex, island, bearsInHand, theirs };
}

describe('Molten Vortex (typed discard-cost chooser)', () => {
  test('a land card pays: 2 damage to the opponent, the Island in my graveyard', () => {
    const { g, vortex, island } = placed();
    expect(offered(g, vortex)).toBe(true);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vortex, abilityIndex: 0, discard: [island] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[island]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('a creature card does not pay', () => {
    const { g, vortex, bearsInHand } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: vortex, abilityIndex: 0, discard: [bearsInHand] });
    expect(res.ok).toBe(false);
    expect(g.state.cards[bearsInHand]?.zone.kind).toBe('hand');
  });

  test('with no land card in hand the ability is not offered', () => {
    const { g, vortex, island } = placed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: island, to: { kind: 'graveyard', player: 'p1' } }));
    expect(offered(g, vortex)).toBe(false);
  });

  test('aimed at a creature: the 2/2 dies', () => {
    const { g, vortex, island, theirs } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vortex, abilityIndex: 0, discard: [island] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g, vortex, island } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vortex, abilityIndex: 0, discard: [island] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
