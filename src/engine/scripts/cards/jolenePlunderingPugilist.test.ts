// `Jolene, Plundering Pugilist` — attacking with a 6/6 makes a Treasure,
// attacking with a 2/2 does not; the Treasure then pays for a ping, and a
// non-Treasure artifact is refused as the price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JOLENE_PLUNDERING_PUGILIST_SCRIPT } from './jolenePlunderingPugilist';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const JOLENE = 'Jolene, Plundering Pugilist';
const TITAN = 'Grave Titan'; // 6/6
const BEARS = 'Grizzly Bears'; // 2/2
const SPELLBOMB = 'Aether Spellbomb'; // an artifact that is not a Treasure
const TREASURE = TOKEN_TABLE['Treasure|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasuresOf(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === TREASURE?.printingId;
  });
}

function board(): { g: Game; jolene: InstanceId; titan: InstanceId; bears: InstanceId; bomb: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[JOLENE, TITAN, BEARS, SPELLBOMB], []],
    scripts: createRegistry([JOLENE_PLUNDERING_PUGILIST_SCRIPT]),
  });
  const jolene = put(g, 'p1', JOLENE);
  const titan = put(g, 'p1', TITAN);
  const bears = put(g, 'p1', BEARS);
  const bomb = put(g, 'p1', SPELLBOMB);
  settle(g);
  holdEverywhere(g);
  return { g, jolene, titan, bears, bomb };
}

function attackWith(g: Game, card: InstanceId): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
  settle(g);
}

describe('Jolene, Plundering Pugilist', () => {
  test('attacking with the 6/6 makes a Treasure', () => {
    const { g, titan } = board();
    attackWith(g, titan);
    expect(treasuresOf(g, 'p1').length).toBe(1);
  });

  test('attacking with only the 2/2 makes nothing', () => {
    const { g, bears } = board();
    attackWith(g, bears);
    expect(treasuresOf(g, 'p1').length).toBe(0);
  });

  test('{1}{R}, sacrifice the Treasure: 1 damage to the opponent', () => {
    const { g, jolene, titan } = board();
    attackWith(g, titan);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const lifeAfterCombat = g.state.players['p2']?.life ?? 0;
    const [treasure] = treasuresOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jolene, abilityIndex: 0, sacrifice: treasure }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(lifeAfterCombat - 1);
    expect(treasuresOf(g, 'p1').length).toBe(0);
  });

  test('a non-Treasure artifact is refused as the price', () => {
    const { g, jolene, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: jolene, abilityIndex: 0, sacrifice: bomb });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, titan } = board();
    attackWith(g, titan);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
