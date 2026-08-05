// `Blinding Souleater` — the first PHYREXIAN activation cost: the parse is
// pinned payable, and one white mana pays the {W/P}.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLINDING_SOULEATER_SCRIPT } from './blindingSouleater';
import { BLINDING_SOULEATER } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SOULEATER = 'Blinding Souleater';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; eater: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SOULEATER], ['Grizzly Bears']],
    scripts: createRegistry([BLINDING_SOULEATER_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const eater = put(g, 'p1', SOULEATER);
  settle(g);
  // An artifact CREATURE — the {T} cost waits out summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, eater, bears };
}

describe('Blinding Souleater', () => {
  test('the parse says what the def assumes: the phyrexian cost is PAYABLE, targeted', () => {
    const oc = ORACLE.byPrinting(BLINDING_SOULEATER.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.targets).toHaveLength(1);
  });

  test('taps the targeted creature on one white mana', () => {
    const { g, eater, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: eater,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[eater]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, eater, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: eater,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
