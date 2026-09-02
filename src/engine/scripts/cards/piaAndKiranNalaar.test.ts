// `Pia and Kiran Nalaar` — two Thopters on entry; one of them pays for a
// ping; a creature that is not an artifact is refused as the price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PIA_AND_KIRAN_NALAAR_SCRIPT } from './piaAndKiranNalaar';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NALAARS = 'Pia and Kiran Nalaar';
const BEARS = 'Grizzly Bears';
const THOPTER = TOKEN_TABLE['Thopter|1/1||Artifact Creature|flying'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thoptersOf(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === THOPTER?.printingId;
  });
}

function entered(): { g: Game; nalaars: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NALAARS, BEARS], []],
    scripts: createRegistry([PIA_AND_KIRAN_NALAAR_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const nalaars = put(g, 'p1', NALAARS);
  settle(g);
  return { g, nalaars, bears };
}

describe('Pia and Kiran Nalaar', () => {
  test('entering makes two 1/1 flying Thopters', () => {
    const { g } = entered();
    expect(thoptersOf(g, 'p1').length).toBe(2);
  });

  test('{2}{R}, sacrifice an artifact: 2 to the opponent, one Thopter fewer', () => {
    const { g, nalaars } = entered();
    const [thopter] = thoptersOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: nalaars, abilityIndex: 0, sacrifice: thopter }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(thoptersOf(g, 'p1').length).toBe(1);
  });

  test('a non-artifact creature is refused as the price', () => {
    const { g, nalaars, bears } = entered();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: nalaars, abilityIndex: 0, sacrifice: bears });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, nalaars } = entered();
    const [thopter] = thoptersOf(g, 'p1') as [InstanceId];
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: nalaars, abilityIndex: 0, sacrifice: thopter }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
