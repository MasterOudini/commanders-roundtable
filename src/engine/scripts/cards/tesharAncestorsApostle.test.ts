// `Teshar, Ancestor's Apostle` — the historic cast watcher that reanimates:
// an ARTIFACT cast pays, a plain creature cast pays nothing, and the aim
// enforces D139's mana-value floor on the graveyard card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TESHAR_ANCESTORS_APOSTLE_SCRIPT } from './tesharAncestorsApostle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TESHAR = "Teshar, Ancestor's Apostle";
const ARTIFACT = 'Sol Ring'; // historic
const PLAIN = 'Grizzly Bears'; // not historic
const CHEAP = 'Grizzly Bears'; // {1}{G} — mana value 2, inside the floor
const BIG = 'Grave Titan'; // {4}{B}{B} — mana value 6, outside it

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(cast: string): { g: Game; corpse: InstanceId; big: InstanceId; g2: Game } {
  const g = startedGame({
    players: 2,
    decks: [[TESHAR, ARTIFACT, PLAIN, CHEAP, BIG], []],
    scripts: createRegistry([TESHAR_ANCESTORS_APOSTLE_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', TESHAR);
  const corpse = put(g, 'p1', CHEAP, 'graveyard');
  const big = put(g, 'p1', BIG, 'graveyard');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  const spell = put(g, 'p1', cast, 'hand');
  for (const symbol of ['G', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 4 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  return { g, corpse, big, g2: g };
}

describe("Teshar, Ancestor's Apostle", () => {
  test('a HISTORIC cast asks, and the answer reanimates', () => {
    const { g, corpse } = game(ARTIFACT);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    expect(g.state.cards[corpse]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[corpse]?.controller).toBe('p1');
  });

  test('a NON-historic cast asks nothing', () => {
    const { g } = game(PLAIN);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, corpse } = game(ARTIFACT);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
