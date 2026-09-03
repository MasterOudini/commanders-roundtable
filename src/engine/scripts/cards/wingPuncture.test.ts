// `Wing Puncture` — my Titan punctures their Nighthawk for 6; a ground
// creature is refused as the second target; the swapped answer resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WING_PUNCTURE_SCRIPT } from './wingPuncture';
import { WING_PUNCTURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wing Puncture';
const TITAN = 'Grave Titan';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; mine: InstanceId; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, TITAN], [HAWK, BEARS]],
    scripts: createRegistry([WING_PUNCTURE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const mine = put(g, 'p1', TITAN);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mine, hawk, bears };
}

describe('Wing Puncture', () => {
  test('the Titan deals 6 to the flyer, which dies; the Titan is untouched', () => {
    const { g, mine, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.damage).toBe(0);
  });

  test('a ground creature is refused as the flyer (the qualifier is enforced, D289)', () => {
    const { g, mine, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the swapped answer is accepted and resolves the same way', () => {
    const { g, mine, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }, { kind: 'card', id: mine }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WING_PUNCTURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WING_PUNCTURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WING_PUNCTURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, mine, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
