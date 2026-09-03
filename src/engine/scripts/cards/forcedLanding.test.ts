// `Forced Landing` — the flyer lands on the bottom of its owner's library
// (the top of a library is the END of the array, so the bottom is index 0);
// a ground creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FORCED_LANDING_SCRIPT } from './forcedLanding';
import { FORCED_LANDING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Forced Landing';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [HAWK, BEARS, 'Island', 'Island', 'Island']],
    scripts: createRegistry([FORCED_LANDING_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, hawk, bears };
}

describe('Forced Landing', () => {
  test('the flyer goes to the bottom of its owner’s library', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'library', player: 'p2' });
    const library = g.state.zones.library.p2 ?? [];
    expect(library[0]).toBe(hawk);
    expect(library.length).toBeGreaterThan(1);
  });

  test('a ground creature is refused at the aim (D289)', () => {
    const { g, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FORCED_LANDING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FORCED_LANDING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FORCED_LANDING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
