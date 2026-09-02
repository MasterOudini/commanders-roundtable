// `Zenith Flare` — X counts CYCLING cards in my graveyard, read off the raw
// keyword list: two cyclers there means 2 damage and 2 life; none means
// nothing at all.
//
// ⚠️ Unearth is the ONLY fixture with Cycling (measured off the dump), so the
// two cyclers are two copies of it — listed twice in the deck because put()
// draws from the LISTED deck (D232). Disdainful Stroke is an INSTANT with no
// cycling (keywords []): it rides along as the second must-not-count witness,
// proving the discriminator is the keyword, not the card type. The first
// draft named it as a cycler from memory and read X=1 — the engine was right.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ZENITH_FLARE_SCRIPT } from './zenithFlare';
import { ZENITH_FLARE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Zenith Flare';
const CYCLER = 'Unearth'; // Cycling {2}
const PLAIN_INSTANT = 'Disdainful Stroke'; // an instant WITHOUT cycling — must not count
const PLAIN_CREATURE = 'Grizzly Bears'; // no cycling — must not count

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(graveyard: string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, CYCLER, CYCLER, PLAIN_INSTANT, PLAIN_CREATURE], []],
    scripts: createRegistry([ZENITH_FLARE_SCRIPT]),
  });
  for (const n of graveyard) put(g, 'p1', n, 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Zenith Flare', () => {
  test('two cyclers plus two plain cards: X is 2 — 2 damage, 2 life', () => {
    const g = cast([CYCLER, CYCLER, PLAIN_INSTANT, PLAIN_CREATURE]);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('a lone cycler: X is 1', () => {
    const g = cast([CYCLER, PLAIN_INSTANT]);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('no cyclers: nothing at all, not zero-amount events', () => {
    const g = cast([PLAIN_INSTANT, PLAIN_CREATURE]);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ZENITH_FLARE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ZENITH_FLARE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ZENITH_FLARE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast([CYCLER, CYCLER]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
