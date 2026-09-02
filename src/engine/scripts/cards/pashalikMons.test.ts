// `Pashalik Mons` — sacrificing a Goblin to the second line makes two
// Goblins AND fires the first (a ping aimed at the opponent); Mons dying
// pings too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PASHALIK_MONS_SCRIPT } from './pashalikMons';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MONS = 'Pashalik Mons';
const GOBLIN_CARD = 'Arms Dealer'; // Creature — Goblin Mercenary
const GOBLIN = TOKEN_TABLE['Goblin|1/1|R|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function goblinsOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === GOBLIN?.printingId;
  }).length;
}

function board(): { g: Game; mons: InstanceId; dealer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MONS, GOBLIN_CARD], []],
    scripts: createRegistry([PASHALIK_MONS_SCRIPT]),
  });
  const dealer = put(g, 'p1', GOBLIN_CARD);
  const mons = put(g, 'p1', MONS);
  settle(g);
  holdEverywhere(g);
  return { g, mons, dealer };
}

describe('Pashalik Mons', () => {
  test('{3}{R}, sacrifice a Goblin: two Goblins, and the death pings the opponent', () => {
    const { g, mons, dealer } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mons, abilityIndex: 0, sacrifice: dealer }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[dealer]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(goblinsOf(g, 'p1')).toBe(2);
  });

  test('Mons itself dying pings', () => {
    const { g, mons } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mons, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, mons, dealer } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mons, abilityIndex: 0, sacrifice: dealer }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
