// `Deserted Temple` — the first TARGETED ActivatedDef (D159): the target is
// chosen at activation, validated by the host, re-checked at resolution
// (CR 608.2b), and this file drives both ends — the untap landing, and the
// fizzle when the target is gone.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DESERTED_TEMPLE_SCRIPT } from './desertedTemple';
import { DESERTED_TEMPLE } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TEMPLE = 'Deserted Temple';

function game(): { g: Game; temple: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TEMPLE, 'Mountain'], []],
    scripts: createRegistry([DESERTED_TEMPLE_SCRIPT]),
  });
  const temple = put(g, 'p1', TEMPLE);
  const mountain = put(g, 'p1', 'Mountain');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mountain], tapped: true }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, temple, mountain };
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Deserted Temple', () => {
  test('the parse says what the def assumes: ability 1, one target clause', () => {
    const oc = ORACLE.byPrinting(DESERTED_TEMPLE.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(2);
    expect(abilities[0]?.isManaAbility).toBe(true);
    expect(abilities[1]?.payable).toBe(true);
    expect(abilities[1]?.targets).toHaveLength(1);
  });

  test('untaps the targeted land, asserted on the EVENT', () => {
    const { g, temple, mountain } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: temple,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: mountain }],
      }),
    );
    settle(g);
    expect(g.state.cards[mountain]?.tapped).toBe(false);
    expect(g.state.cards[temple]?.tapped).toBe(true);
    expect(
      g.log.some((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(mountain)),
    ).toBe(true);
  });

  test('a target that left the battlefield fizzles the ability (CR 608.2b)', () => {
    const { g, temple, mountain } = game();
    // ⚠️ HOLD EVERYWHERE, or there is no window: with default stops the whole
    // stack can resolve inside the activation's own submit (D119's auto-pass),
    // and the bounce below would arrive after the untap — a test of nothing.
    holdEverywhere(g);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: temple,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: mountain }],
      }),
    );
    // The ability sits on the stack; bounce its target from under it.
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: mountain,
        to: { kind: 'hand', player: 'p1' },
      }),
    );
    const logAt = g.log.length;
    settle(g);
    expect(
      g.log.slice(logAt).some((e) => e.body.t === 'Narrated' && /no legal target left/.test(e.body.text)),
    ).toBe(true);
    expect(
      g.log.slice(logAt).some((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(mountain)),
    ).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, temple, mountain } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: temple,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: mountain }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
