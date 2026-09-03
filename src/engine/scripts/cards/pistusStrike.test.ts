// `Pistus Strike` — the flyer dies and its controller takes a poison
// counter; a ground creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PISTUS_STRIKE_SCRIPT } from './pistusStrike';
import { PISTUS_STRIKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Pistus Strike';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [HAWK, BEARS]],
    scripts: createRegistry([PISTUS_STRIKE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, hawk, bears };
}

describe('Pistus Strike', () => {
  test('the flyer dies and its controller gets a poison counter', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.players.p2?.poison).toBe(1);
    expect(g.state.players.p1?.poison).toBe(0);
  });

  test('a ground creature is refused at the aim (D289)', () => {
    const { g, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PISTUS_STRIKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PISTUS_STRIKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PISTUS_STRIKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
