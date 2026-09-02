// `Word of Undoing` — the creature goes home, and so does a WHITE Aura I OWN
// attached to it; the Aura is CAST onto the creature because a hand-placed
// Aura is binned unattached by SBA (D269's Winds of Rath measurement).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WORD_OF_UNDOING_SCRIPT } from './wordOfUndoing';
import { WORD_OF_UNDOING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Word of Undoing';
const BEARS = 'Grizzly Bears';
const AURA = 'Pacifism'; // WHITE, and mine

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bears: InstanceId; aura: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS, BEARS, AURA],
      [],
    ],
    scripts: createRegistry([WORD_OF_UNDOING_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const other = put(g, 'p1', BEARS);
  settle(g);

  const aura = put(g, 'p1', AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  expect(g.state.cards[aura]?.attachedTo).toBe(bears);

  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, aura, other };
}

describe('Word of Undoing', () => {
  test('the creature AND the white Aura I own on it both go to hand', () => {
    const { g, bears, aura } = cast();
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[aura]?.zone.kind).toBe('hand');
  });

  test('an unattached creature is untouched', () => {
    const { g, other } = cast();
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WORD_OF_UNDOING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WORD_OF_UNDOING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WORD_OF_UNDOING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
