// `Trading Post` - each of the four abilities from its own cost: a discard gains 4
// life, a life payment makes a Goat, a sacrificed creature returns an artifact card
// (a creature card refused), a sacrificed artifact draws; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TRADING_POST_SCRIPT } from './tradingPost';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Trading Post';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; handCard: InstanceId; fodder: InstanceId; artifact: InstanceId; ring: InstanceId; bears: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, BEARS, RING, RING, BEARS], [BEARS]], scripts: createRegistry([TRADING_POST_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const handCard = put(g, 'p1', BEARS, 'hand');
  const fodder = put(g, 'p1', BEARS);
  const artifact = put(g, 'p1', RING);
  const ring = put(g, 'p1', RING, 'graveyard');
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, handCard, fodder, artifact, ring, bears, life0 };
}

describe('Trading Post', () => {
  test('discard a card: gain 4 life', () => {
    const { g, self, handCard, life0 } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, discard: [handCard] }));
    settle(g);
    expect(g.state.cards[handCard]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(life0 + 4);
  });

  test('pay 1 life: a 0/1 Goat token', () => {
    const { g, self, life0 } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.controller === 'p1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.oracleId).toBe(TOKEN_TABLE['Goat|0/1|W|Creature|']?.oracleId);
  });

  test('sacrifice a creature: return the artifact card, refuse the creature card', () => {
    const { g, self, fodder, ring, bears } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2, sacrifice: fodder }));
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('hand');
  });

  test('sacrifice an artifact: draw a card', () => {
    const { g, self, artifact } = armed();
    const before = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 3, sacrifice: artifact }));
    settle(g);
    expect(g.state.cards[artifact]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, self, artifact } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 3, sacrifice: artifact }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
