// `Racecourse Fury` - the carrier proven end to end (D367): the recipient HAS the quoted
// ability, is OFFERED it, and activating it charges the RECIPIENT's own cost and runs
// the payload; a permanent outside the scope is offered nothing. Generated from one row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { legalActions } from '../../legal';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RACECOURSE_FURY_SCRIPT } from './racecourseFury';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Racecourse Fury";
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

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Racecourse Fury","Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([RACECOURSE_FURY_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Forest");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // ⚠️ CAST the Aura: one moved onto the battlefield by hand is UNATTACHED, and the
  // state-based action bins it before anything can attach it (D269).
  mana(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, self, host, no };
}

/** Enough of every colour for any printed cost in this family; the solver picks. */
function mana(g: Game): void {
  for (const sym of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 8 }));
  }
}

function offers(g: Game, card: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((x) => x.t === 'ActivateAbility' && x.card === card);
}

describe("Racecourse Fury", () => {
  test("grants {T}: Target creature gains haste until end of turn. to Forest, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedActivated).toHaveLength(1);
    expect(d.grantedActivated[0]?.provider).toBe(self);
    // The standing negative: a permanent outside the scope has nothing.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedActivated).toHaveLength(0);
  });

  test('the recipient is offered it, and activating it charges the RECIPIENT and runs the payload', () => {
    const { g, self, host, no } = board();
    const granted = offers(g, host).filter((x) => x.t === 'ActivateAbility' && x.grantRef !== undefined);
    expect(granted).toHaveLength(1);
    const offer = granted[0];
    expect(offer?.t === 'ActivateAbility' && offer.costText).toBe("{T}");
    const ref = offer?.t === 'ActivateAbility' ? (offer.grantRef as string) : '';
    mana(g);
    must(g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: host,
      abilityIndex: 0,
      grantRef: ref,
      targets: [{ kind: 'card', id: no }],
    }));
    // CR 602.2b - the tap is the RECIPIENT's, paid as part of the cost.
    expect(g.state.cards[host]?.tapped).toBe(true);
    settle(g);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, no).has("haste")).toBe(true);
    expect(self).toBeDefined();
    expect(no).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
