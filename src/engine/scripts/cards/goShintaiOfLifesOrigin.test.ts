// `Go-Shintai of Life's Origin` - its own entering makes a Shrine token; the
// activation returns an enchantment card from the graveyard to the battlefield and
// refuses a creature card; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GO_SHINTAI_OF_LIFES_ORIGIN_SCRIPT } from './goShintaiOfLifesOrigin';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Go-Shintai of Life's Origin";
const DEATHGRIP = 'Deathgrip'; // an enchantment card
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; grip: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, DEATHGRIP, BEARS], [BEARS]], scripts: createRegistry([GO_SHINTAI_OF_LIFES_ORIGIN_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const grip = put(g, 'p1', DEATHGRIP, 'graveyard');
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, self, grip, bears };
}

describe("Go-Shintai of Life's Origin", () => {
  test('entering makes a 1/1 Shrine token', () => {
    const { g } = armed();
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.controller === 'p1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.oracleId).toBe(TOKEN_TABLE['Shrine|1/1||Creature Enchantment|']?.oracleId);
  });

  test('the activation returns an enchantment card to the battlefield and refuses a creature card', () => {
    const { g, self, grip, bears } = armed();
    // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    for (const sym of ['W', 'U', 'B', 'R', 'G'] as const) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: grip }] }));
    settle(g);
    expect(g.state.cards[grip]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
