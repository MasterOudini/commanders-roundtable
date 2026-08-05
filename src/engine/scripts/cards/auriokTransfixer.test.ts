// `Auriok Transfixer` — the tap lands on an untapped artifact and no-ops on a
// turned one, asserted on the EVENT both ways. The creature waits out its
// summoning sickness before activating a {T} cost (CR 302.6).

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AURIOK_TRANSFIXER_SCRIPT } from './auriokTransfixer';
import { AURIOK_TRANSFIXER } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRANSFIXER = 'Auriok Transfixer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; fixer: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRANSFIXER], ['Darksteel Myr']],
    scripts: createRegistry([AURIOK_TRANSFIXER_SCRIPT]),
  });
  const myr = put(g, 'p2', 'Darksteel Myr');
  const fixer = put(g, 'p1', TRANSFIXER);
  settle(g);
  // Past summoning sickness: the {T} in the cost needs the creature under its
  // controller's control since their last untap.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, fixer, myr };
}

describe('Auriok Transfixer', () => {
  test('the parse says what the def assumes: one payable, targeted ability', () => {
    const oc = ORACLE.byPrinting(AURIOK_TRANSFIXER.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.targets).toHaveLength(1);
  });

  test('taps the targeted artifact, asserted on the EVENT', () => {
    const { g, fixer, myr } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: fixer,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: myr }],
      }),
    );
    settle(g);
    expect(g.state.cards[myr]?.tapped).toBe(true);
    expect(
      g.log.some((e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(myr)),
    ).toBe(true);
  });

  test('a target ALREADY tapped gets no event — the mirror of the untap guard', () => {
    const { g, fixer, myr } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [myr], tapped: true }));
    const logAt = g.log.length;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: fixer,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: myr }],
      }),
    );
    settle(g);
    expect(
      g.log.slice(logAt).some((e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(myr)),
    ).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, fixer, myr } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: fixer,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: myr }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
