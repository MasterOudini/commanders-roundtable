// `Wave Goodbye` — a +1/+1 counter is the ONLY thing that saves a creature,
// and my own uncountered creatures go home with theirs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WAVE_GOODBYE_SCRIPT } from './waveGoodbye';
import { WAVE_GOODBYE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wave Goodbye';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring'; // not a creature — must stay put

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  countered: InstanceId;
  ring: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS, RING],
      [BEARS, BEARS],
    ],
    scripts: createRegistry([WAVE_GOODBYE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const ring = put(g, 'p1', RING);
  const theirs = put(g, 'p2', BEARS);
  const countered = put(g, 'p2', BEARS);
  settle(g);
  must(
    g.submit({
      t: 'ManualSetCounter',
      player: 'p2',
      card: countered,
      kind: '+1/+1',
      delta: 1,
    }),
  );
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, countered, ring };
}

describe('Wave Goodbye', () => {
  test('every UNCOUNTERED creature goes home, mine included', () => {
    const { g, mine, theirs } = cast();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
  });

  test('a creature WITH a +1/+1 counter stays', () => {
    const { g, countered } = cast();
    expect(g.state.cards[countered]?.zone.kind).toBe('battlefield');
  });

  test('a non-creature is untouched', () => {
    const { g, ring } = cast();
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WAVE_GOODBYE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WAVE_GOODBYE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WAVE_GOODBYE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
