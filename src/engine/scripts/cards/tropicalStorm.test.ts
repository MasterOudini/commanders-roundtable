// `Tropical Storm` — the OVERLAP is the card: a blue flyer takes X+1, a
// WHITE flyer takes X, a blue ground creature takes 1, and a non-blue
// ground creature takes nothing. One board, four answers.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TROPICAL_STORM_SCRIPT } from './tropicalStorm';
import { TROPICAL_STORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tropical Storm';
const BLUE_FLYER = 'Air Elemental'; // {3}{U}{U} 4/4 flying — blue AND flying
const WHITE_FLYER = 'Serra Angel'; // {3}{W}{W} 4/4 flying — flying but NOT blue
const BLUE_GROUND = 'Tidepool Turtle'; // {3}{U} — blue, no flying
const GREEN_GROUND = 'Grizzly Bears'; // {1}{G} — neither

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stormed(x: number): {
  g: Game;
  blueFlyer: InstanceId;
  blueGround: InstanceId;
  greenGround: InstanceId;
  whiteFlyer: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BLUE_FLYER, BLUE_GROUND, GREEN_GROUND, WHITE_FLYER], []],
    scripts: createRegistry([TROPICAL_STORM_SCRIPT]),
  });
  const blueFlyer = put(g, 'p1', BLUE_FLYER);
  const blueGround = put(g, 'p1', BLUE_GROUND);
  const greenGround = put(g, 'p1', GREEN_GROUND);
  const whiteFlyer = put(g, 'p1', WHITE_FLYER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: x + 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  settle(g);
  return { g, blueFlyer, blueGround, greenGround, whiteFlyer };
}

describe('Tropical Storm', () => {
  test('X=2: blue flyer 3, WHITE flyer 2, blue ground 1, green ground 0', () => {
    const { g, blueFlyer, blueGround, greenGround, whiteFlyer } = stormed(2);
    expect(g.state.cards[blueFlyer]?.damage).toBe(3);
    // The white flyer takes X and NOT the rider: the two clauses are
    // independent, which is the whole shape of the card.
    expect(g.state.cards[whiteFlyer]?.damage).toBe(2);
    expect(g.state.cards[blueGround]?.damage).toBe(1);
    expect(g.state.cards[greenGround]?.damage).toBe(0);
  });

  test('X=0: only the blue creatures are touched, for 1 apiece', () => {
    const { g, blueFlyer, blueGround, greenGround, whiteFlyer } = stormed(0);
    expect(g.state.cards[blueFlyer]?.damage).toBe(1);
    expect(g.state.cards[whiteFlyer]?.damage).toBe(0);
    expect(g.state.cards[blueGround]?.damage).toBe(1);
    expect(g.state.cards[greenGround]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TROPICAL_STORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TROPICAL_STORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TROPICAL_STORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stormed(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
