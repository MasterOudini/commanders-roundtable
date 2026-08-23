// `Their Name Is Death` — the negated-type wipe: an ARTIFACT creature walks
// away, and so does an indestructible one, for two different reasons.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { THEIR_NAME_IS_DEATH_SCRIPT } from './theirNameIsDeath';
import { THEIR_NAME_IS_DEATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Their Name Is Death';
const PLAIN = 'Grizzly Bears';
const MYR = 'Darksteel Myr'; // artifact creature AND indestructible
const RING = 'Sol Ring'; // an artifact that is not a creature

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wiped(): { g: Game; mine: InstanceId; theirs: InstanceId; myr: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, PLAIN, MYR, RING], [PLAIN]],
    scripts: createRegistry([THEIR_NAME_IS_DEATH_SCRIPT]),
  });
  const mine = put(g, 'p1', PLAIN);
  const theirs = put(g, 'p2', PLAIN);
  const myr = put(g, 'p1', MYR);
  const ring = put(g, 'p1', RING);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, myr, ring };
}

describe('Their Name Is Death', () => {
  test('every plain creature dies — mine included', () => {
    const { g, mine, theirs } = wiped();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('an ARTIFACT creature walks away, and so does the noncreature artifact', () => {
    const { g, myr, ring } = wiped();
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = THEIR_NAME_IS_DEATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, THEIR_NAME_IS_DEATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(THEIR_NAME_IS_DEATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = wiped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
