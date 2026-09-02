// `Stimulus Package` — two Treasures on entry; a Treasure sacrificed for no
// mana is a Citizen.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STIMULUS_PACKAGE_SCRIPT } from './stimulusPackage';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PACKAGE = 'Stimulus Package';
const TREASURE = TOKEN_TABLE['Treasure|/||Artifact|'];
const CITIZEN = TOKEN_TABLE['Citizen|1/1|GW|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokensOf(g: Game, player: string, printingId: string | undefined): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === printingId;
  });
}

function opened(): { g: Game; pkg: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PACKAGE], []],
    scripts: createRegistry([STIMULUS_PACKAGE_SCRIPT]),
  });
  const pkg = put(g, 'p1', PACKAGE);
  settle(g);
  return { g, pkg };
}

describe('Stimulus Package', () => {
  test('entering makes two Treasures', () => {
    const { g } = opened();
    expect(tokensOf(g, 'p1', TREASURE?.printingId).length).toBe(2);
  });

  test('sacrifice a Treasure: a 1/1 Citizen', () => {
    const { g, pkg } = opened();
    const [treasure] = tokensOf(g, 'p1', TREASURE?.printingId) as [InstanceId];
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pkg, abilityIndex: 0, sacrifice: treasure, targets: [] }));
    settle(g);
    expect(tokensOf(g, 'p1', CITIZEN?.printingId).length).toBe(1);
    expect(tokensOf(g, 'p1', TREASURE?.printingId).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, pkg } = opened();
    const [treasure] = tokensOf(g, 'p1', TREASURE?.printingId) as [InstanceId];
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pkg, abilityIndex: 0, sacrifice: treasure, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
