// `Azami, Lady of Scrolls` — the tap chooser (D286): Azami taps HERSELF the
// turn she enters (no tap symbol, so CR 302.6 does not apply) and I draw; a
// bear is not a Wizard and is refused; naming nothing is refused; with no
// untapped Wizard the ability is not offered.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { AZAMI_LADY_OF_SCROLLS_SCRIPT } from './azamiLadyOfScrolls';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AZAMI = 'Azami, Lady of Scrolls';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function offered(g: Game, card: InstanceId): boolean {
  const d = deps(createRegistry([AZAMI_LADY_OF_SCROLLS_SCRIPT]));
  return legalActions(g.state, d.oracle, d.scripts, 'p1').some(
    (a) => a.t === 'ActivateAbility' && a.card === card && a.abilityIndex === 0,
  );
}

function placed(): { g: Game; azami: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AZAMI, BEARS], []],
    scripts: createRegistry([AZAMI_LADY_OF_SCROLLS_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const azami = put(g, 'p1', AZAMI);
  settle(g);
  return { g, azami, bears };
}

describe('Azami, Lady of Scrolls (tap-cost chooser)', () => {
  test('tapping herself the turn she enters draws a card', () => {
    const { g, azami } = placed();
    expect(offered(g, azami)).toBe(true);
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: azami, abilityIndex: 0, tap: [azami], targets: [] }));
    settle(g);
    expect(g.state.cards[azami]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a bear is not a Wizard; naming nothing is refused too', () => {
    const { g, azami, bears } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: azami, abilityIndex: 0, tap: [bears], targets: [] }).ok).toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: azami, abilityIndex: 0, targets: [] }).ok).toBe(false);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('once she is tapped the ability is no longer offered', () => {
    const { g, azami } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: azami, abilityIndex: 0, tap: [azami], targets: [] }));
    settle(g);
    expect(offered(g, azami)).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, azami } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: azami, abilityIndex: 0, tap: [azami], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
