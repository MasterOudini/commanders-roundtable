// `Barrin, Master Wizard` — the empty predicate feeding a bounce: any
// permanent pays (a LAND here), and the creature goes to its OWNER's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARRIN_MASTER_WIZARD_SCRIPT } from './barrinMasterWizard';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BARRIN = 'Barrin, Master Wizard';
const FOUNTAIN = 'Radiant Fountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; barrin: InstanceId; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BARRIN, FOUNTAIN], [BEARS]],
    scripts: createRegistry([BARRIN_MASTER_WIZARD_SCRIPT]),
  });
  const barrin = put(g, 'p1', BARRIN);
  const land = put(g, 'p1', FOUNTAIN);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, barrin, land, bears };
}

describe('Barrin, Master Wizard', () => {
  test('a land pays "a permanent", and the creature bounces to its OWNER', () => {
    const { g, barrin, land, bears } = game();
    const handBefore = idsIn(g, 'p2', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: barrin, abilityIndex: 0, sacrifice: land }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(idsIn(g, 'p2', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[barrin]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, barrin, land, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: barrin, abilityIndex: 0, sacrifice: land }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
