// D393 - THREATEN (CR 514.2): "Gain control of target <noun> until end of turn." is a control change
// WITH AN END. The executor emits `ControlChangedUntilEndOfTurn` (the permanent is summoning-sick
// under its new controller, CR 302.6 - the printed haste is what lets it attack), the until-end-
// of-turn list remembers who gets it back, and the cleanup step hands it back before the list is
// cleared. With D392's referent the whole Act of Treason text reads by the vocabulary.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

function derived(g: Game, id: InstanceId) {
  const d = deps(createRegistry([]));
  return derive(g.state, d.oracle, d.scripts, id);
}

const ACT = 'Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.';

describe('the threaten vocabulary (D393)', () => {
  test('the control sentence is read with its end, and the whole Act of Treason text reads by the vocabulary', () => {
    const one = parseEffects('Gain control of target creature until end of turn.', 'Test Card', true);
    expect(one.mode).toBe('auto');
    expect(one.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['control', 0]]);
    const act = parseEffects(ACT, 'Act of Treason', true);
    expect(act.mode).toBe('auto');
    expect(act.effects.map((e) => [e.kind, e.targetIndex, e.referent ?? false])).toEqual([
      ['control', 0, false],
      ['untap', 0, true],
      ['pump', 0, true],
    ]);
    expect(act.effects[2]?.keywords).toEqual(['haste']);
    const hijack = parseEffects('Gain control of target artifact or creature until end of turn. Untap it. It gains haste until end of turn.', 'Hijack', true);
    expect(hijack.mode).toBe('auto');
  });

  test('a permanent control change and the compound form stay unread', () => {
    expect(parseEffects('Gain control of target creature.', 'Test Card', true).mode).not.toBe('auto');
    expect(parseEffects('Untap target creature and gain control of it until end of turn.', 'Threaten', true).mode).not.toBe('auto');
  });
});

describe('threaten in play (D393)', () => {
  function stolen(): { g: Game; bears: InstanceId; t0: number } {
    const g = startedGame({ players: 2, decks: [['Act of Treason', 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears], tapped: true }));
    const act = put(g, 'p1', 'Act of Treason', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: act, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    return { g, bears, t0: g.state.turn.turnNumber };
  }

  test('the creature is taken, untapped and hasty, attacks this turn, and goes back at cleanup', () => {
    const { g, bears, t0 } = stolen();
    expect(g.state.cards[bears]?.controller, 'taken').toBe('p1');
    expect(g.state.cards[bears]?.tapped, 'untapped by the referent').toBe(false);
    expect(g.state.cards[bears]?.summonedOnTurn, 'summoning-sick under its new controller (CR 302.6)').toBe(t0);
    expect(derived(g, bears).keywords.has('haste'), 'hasty by the referent').toBe(true);
    expect(g.state.untilEndOfTurn.filter((m) => m.controlRevert === 'p2').map((m) => m.card)).toEqual([bears]);
    // It attacks THIS turn: the haste beats the sickness the control change put on it.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('declareAttackers');
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 1, 20_000);
    expect((g.state.players.p2?.life ?? 0), 'the stolen creature connected').toBe(life0 - 2);
    // Cleanup handed it back and forgot the revert.
    expect(g.state.cards[bears]?.controller, 'back with its owner at cleanup').toBe('p2');
    expect(g.state.untilEndOfTurn.some((m) => m.controlRevert !== undefined)).toBe(false);
    expect(g.log.filter((e) => e.body.t === 'ControlChanged' && e.body.card === bears)).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a stolen creature that leaves the battlefield is not handed back, and the game replays', () => {
    const { g, bears, t0 } = stolen();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 1, 20_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.filter((e) => e.body.t === 'ControlChanged' && e.body.card === bears)).toHaveLength(0);
    expect(g.state.untilEndOfTurn.some((m) => m.controlRevert !== undefined)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('taking what is already yours changes nothing and remembers nothing', () => {
    const g = startedGame({ players: 2, decks: [['Act of Treason', 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const act = put(g, 'p1', 'Act of Treason', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: act, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.controller).toBe('p1');
    expect(g.log.some((e) => e.body.t === 'ControlChangedUntilEndOfTurn')).toBe(false);
    expect(g.state.untilEndOfTurn.some((m) => m.controlRevert !== undefined)).toBe(false);
    expect(derived(g, bears).keywords.has('haste')).toBe(true);
  });
});
