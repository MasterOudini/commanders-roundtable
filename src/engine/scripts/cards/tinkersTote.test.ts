// `Tinker's Tote` — two colorless Gnomes on entry; white mana and the Tote
// itself buy 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TINKERS_TOTE_SCRIPT } from './tinkersTote';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TOTE = "Tinker's Tote";
const GNOME = TOKEN_TABLE['Gnome|1/1||Artifact Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gnomes(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === GNOME?.printingId;
  });
}

function opened(): { g: Game; tote: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TOTE], []],
    scripts: createRegistry([TINKERS_TOTE_SCRIPT]),
  });
  const tote = put(g, 'p1', TOTE);
  settle(g);
  return { g, tote };
}

describe("Tinker's Tote", () => {
  test('entering makes two Gnomes', () => {
    const { g } = opened();
    expect(gnomes(g, 'p1').length).toBe(2);
  });

  test('{W}, sacrifice: 3 life, the Gnomes stay', () => {
    const { g, tote } = opened();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tote, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[tote]?.zone.kind).toBe('graveyard');
    expect(gnomes(g, 'p1').length).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, tote } = opened();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tote, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
