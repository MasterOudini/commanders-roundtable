// D451 - BLOODRUSH AND REINFORCE: THE HAND ACTIVATIONS WITH A DISCARD-SELF COST. "Discard this card" in an activated
// ability's cost is a deterministic price the engine takes from the HAND (CR 113.6 - cycling's zone, D306), charged in
// the cost batch as an ordinary discard. Bloodrush is an ability word whose rule is printed whole (the word stripped,
// D342's list), so its line is a printed ability a def runs; Reinforce N—{cost} is synthesized (D440's scavenge shape)
// and resolves natively - N +1/+1 counters on the target creature. Proven on Bannerhide Krushok (reinforce 2, no
// script) and Scorchwalker (bloodrush, an inline def that pumps the target - what a generated row would register).

import { describe, expect, test } from 'vitest';
import { SCORCHWALKER } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { derive } from './derive';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCORCHWALKER_DEF: CardScript = {
  oracleId: SCORCHWALKER.oracleId,
  name: SCORCHWALKER.name,
  activated: [
    {
      ref: `${SCORCHWALKER.oracleId}#a0`,
      text: SCORCHWALKER.faces[0]?.oracleText ?? '',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 5, toughness: 1 }];
      },
    },
  ],
};
const SCRIPTS = createRegistry([SCORCHWALKER_DEF]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(SCRIPTS);
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}
function mana(g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
}
function indexOf(name: string, pred: (a: { costText: string }) => boolean): number {
  return ORACLE.byName(name)?.faces[0]?.activated.findIndex(pred) ?? -1;
}

describe('D451 - the parses', () => {
  test('Reinforce is synthesized from the hand; Bloodrush is a printed ability with a discard-self price', () => {
    const k = ORACLE.byName('Bannerhide Krushok')?.faces[0]?.activated.find((a) => a.reinforce !== undefined);
    expect(k?.reinforce).toEqual({ line: 'Reinforce 2—{1}{G}', n: 2 });
    expect(k?.discardsSelf).toBe(true);
    expect(k?.costText).toBe('{1}{G}, Discard this card');
    const s = ORACLE.byName('Scorchwalker')?.faces[0]?.activated[0];
    expect(s?.discardsSelf).toBe(true);
    expect(s?.unpaidCosts).toEqual([]);
    expect(s?.payable).toBe(true);
    expect(s?.targets[0]?.combatRole).toBe('attacking');
  });
});

function armed(): { g: Game; krushok: InstanceId; walker: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Bannerhide Krushok', 'Scorchwalker', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const krushok = put(g, 'p1', 'Bannerhide Krushok', 'hand');
  const walker = put(g, 'p1', 'Scorchwalker', 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, krushok, walker, bears };
}

describe('D451 - reinforce, charged and resolved (Bannerhide Krushok)', () => {
  test('from the hand: the card is discarded as the cost and the target gets two counters', () => {
    const { g, krushok, bears } = armed();
    const index = indexOf('Bannerhide Krushok', (a) => a.costText === '{1}{G}, Discard this card');
    expect(index).toBeGreaterThanOrEqual(0);
    mana(g, 'C', 1);
    mana(g, 'G', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: krushok, abilityIndex: index, targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[krushok]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === krushok && m.reason === 'discard'))).toBe(true);
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(pt(g, bears)).toEqual([4, 4]);
  });

  test('refused from the battlefield; refused with the mana short', () => {
    const { g, krushok, bears } = armed();
    const index = indexOf('Bannerhide Krushok', (a) => a.costText === '{1}{G}, Discard this card');
    mana(g, 'G', 1);
    const short = g.submit({ t: 'ActivateAbility', player: 'p1', card: krushok, abilityIndex: index, targets: [{ kind: 'card', id: bears }] });
    expect(short.ok).toBe(false);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: krushok, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    mana(g, 'C', 1);
    mana(g, 'G', 1);
    const fielded = g.submit({ t: 'ActivateAbility', player: 'p1', card: krushok, abilityIndex: index, targets: [{ kind: 'card', id: bears }] });
    expect(fielded.ok).toBe(false);
    if (!fielded.ok) expect(fielded.reason).toBe('wrongZone');
  });
});

describe('D451 - bloodrush, charged and resolved (Scorchwalker)', () => {
  test('the attacking Bears is pumped from the hand during combat and Scorchwalker is discarded', () => {
    const { g, walker, bears } = armed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    mana(g, 'C', 1);
    mana(g, 'R', 2);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: walker, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[walker]?.zone.kind).toBe('graveyard');
    expect(pt(g, bears)).toEqual([7, 3]);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life).toBe(33);
  });

  test('outside combat there is no attacking creature to aim at: the activation is refused', () => {
    const { g, walker, bears } = armed();
    mana(g, 'C', 1);
    mana(g, 'R', 2);
    const idle = g.submit({ t: 'ActivateAbility', player: 'p1', card: walker, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] });
    expect(idle.ok).toBe(false);
    expect(g.state.cards[walker]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g, walker, bears } = armed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    mana(g, 'C', 1);
    mana(g, 'R', 2);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: walker, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
