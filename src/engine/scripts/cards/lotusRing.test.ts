// `Lotus Ring` - the granted MANA ability proven end to end (D372): the recipient HAS the
// production, is OFFERED the tap, and tapping charges the RECIPIENT and adds the mana; a
// permanent outside the scope has nothing. Generated from one row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { legalActions } from '../../legal';
import { replay, stateHash } from '../../log';
import { manaSourcesOf } from '../../mana';
import { createRegistry } from '../registryCore';
import { LOTUS_RING_SCRIPT } from './lotusRing';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Lotus Ring";
const QUOTED = "{T}, Sacrifice this creature: Add three mana of any one color.";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = derive(g.state, g.deps.oracle, g.deps.scripts, id);
  return [d.power, d.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  return derive(g.state, g.deps.oracle, g.deps.scripts, id).keywords;
}

function granted(g: Game, id: InstanceId) {
  return derive(g.state, g.deps.oracle, g.deps.scripts, id).producesMana.find((p) => p.text === QUOTED);
}
function poolTotal(g: Game): number {
  const pool = g.state.players.p1?.pool;
  return pool ? pool.W + pool.U + pool.B + pool.R + pool.G + pool.C : -1;
}
function taps(g: Game, card: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((x) => x.t === 'TapForMana' && x.card === card);
}

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Lotus Ring","Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([LOTUS_RING_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAttach', player: 'p1', card: self, to: host }));
  settle(g);
  return { g, self, host, no };
}

describe("Lotus Ring", () => {
  test("grants {T}, Sacrifice this creature: Add three mana of any one color. to Grizzly Bears, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const prod = granted(g, host);
    expect(prod).toBeDefined();
    expect(prod?.requiresTap).toBe(true);
    // The standing negative: a permanent outside the scope has nothing.
    expect(granted(g, no)).toBeUndefined();
    expect(self).toBeDefined();
    expect(pt(g, host)).toEqual([5, 5]);
    expect(kw(g, host).has("vigilance")).toBe(true);
  });

  test('the recipient is offered it, and tapping it charges the RECIPIENT and adds the mana', () => {
    const { g, host } = board();
    const prod = granted(g, host);
    const index = prod?.abilityIndex ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    const offer = taps(g, host).find((x) => x.t === 'TapForMana' && x.abilityIndex === index);
    expect(offer).toBeDefined();
    expect(offer?.t === 'TapForMana' && offer.outputs.length).toBeGreaterThan(0);
    // ⚠️ A price beside the tap: never an auto-tap source (D325); the hand menu offers it.
    expect(manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', {}).some((x) => x.card === host && x.abilityIndex === index)).toBe(false);
    const before = poolTotal(g);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: host, abilityIndex: index, outputChoice: 0 }));
    // The recipient IS the source: "Sacrifice this permanent" eats the recipient, not the provider.
    expect(g.state.cards[host]?.zone.kind).toBe('graveyard');
    expect(poolTotal(g)).toBe(before + 3);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
