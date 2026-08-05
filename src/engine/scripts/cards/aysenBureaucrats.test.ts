// `Aysen Bureaucrats` — "power 2 or less" is D139's numeric restriction
// riding the activated path: a 2/2 is tappable, a 5/5 is REFUSED at
// activation, asserted from both sides.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AYSEN_BUREAUCRATS_SCRIPT } from './aysenBureaucrats';
import { AYSEN_BUREAUCRATS } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BUREAUCRATS = 'Aysen Bureaucrats';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; clerks: InstanceId; bears: InstanceId; wurm: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BUREAUCRATS], ['Grizzly Bears', 'Armada Wurm']],
    scripts: createRegistry([AYSEN_BUREAUCRATS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const wurm = put(g, 'p2', 'Armada Wurm');
  const clerks = put(g, 'p1', BUREAUCRATS);
  settle(g);
  // Past summoning sickness: the {T} in the cost needs the creature under its
  // controller's control since their last untap.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, clerks, bears, wurm };
}

describe('Aysen Bureaucrats', () => {
  test('the parse says what the def assumes: one payable, targeted ability', () => {
    const oc = ORACLE.byPrinting(AYSEN_BUREAUCRATS.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.targets).toHaveLength(1);
  });

  test('taps a power-2 creature, asserted on the EVENT', () => {
    const { g, clerks, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: clerks,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(
      g.log.some((e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(bears)),
    ).toBe(true);
  });

  test('a 5/5 is REFUSED at activation — the numeric restriction is enforced', () => {
    const { g, clerks, wurm } = game();
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: clerks,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: wurm }],
    });
    expect(res.ok).toBe(false);
    expect(g.state.cards[wurm]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, clerks, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: clerks,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
