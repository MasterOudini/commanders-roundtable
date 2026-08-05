// `Soul Warden` — the first card of the first shipped batch (M6.4a, D158), and
// the file that proves the TWO-DEF rule: a card entering is `CardsMoved`, a
// token entering is `TokenCreated`, and a script watching one kind alone is a
// Soul Warden that misses half the creatures in a real game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOUL_WARDEN_SCRIPT } from './soulWarden';
import { ESSENCE_WARDEN_SCRIPT } from './essenceWarden';
import { SOLDIER_TOKEN, TREASURE_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { CardScript } from '../api';

const WARDEN = 'Soul Warden';

function game(script: CardScript = SOUL_WARDEN_SCRIPT): Game {
  return startedGame({
    players: 2,
    decks: [
      [WARDEN, 'Grizzly Bears', 'Radiant Fountain'],
      ['Silvercoat Lion'],
    ],
    scripts: createRegistry([script]),
  });
}

/** Resolve everything the last intent queued — triggers, stack, prompts. */
function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lifeOf(g: Game, player: string): number {
  return g.state.players[player]?.life ?? -1;
}

function gains(g: Game): number {
  return g.log.filter((e) => e.body.t === 'LifeChanged').length;
}

describe('Soul Warden', () => {
  test('its OWN entry gains nothing — the card says "another"', () => {
    const g = game();
    const before = gains(g);
    put(g, 'p1', WARDEN);
    settle(g);
    expect(gains(g)).toBe(before);
    expect(lifeOf(g, 'p1')).toBe(40);
  });

  test('another creature entering gains 1, asserted on the EVENT', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    const before = gains(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    // ⚠️ The EVENT COUNT, not just the total — a gain that happened twice and
    // was half undone elsewhere would leave the same 41.
    expect(gains(g)).toBe(before + 1);
    expect(lifeOf(g, 'p1')).toBe(41);
    expect(
      g.log.some(
        (e) => e.body.t === 'LifeChanged' && e.body.player === 'p1' && e.body.delta === 1,
      ),
    ).toBe(true);
  });

  test("an OPPONENT'S creature entering also gains — 'another creature', not 'yours'", () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    const before = lifeOf(g, 'p1');
    put(g, 'p2', 'Silvercoat Lion');
    settle(g);
    expect(lifeOf(g, 'p1')).toBe(before + 1);
    expect(lifeOf(g, 'p2')).toBe(40);
  });

  test('a LAND entering gains nothing — `derive` answers "creature", not the move', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    const before = gains(g);
    put(g, 'p1', 'Radiant Fountain');
    settle(g);
    expect(gains(g)).toBe(before);
  });

  test('a creature TOKEN gains — one firing per TokenCreated, so two tokens gain 2', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    const before = lifeOf(g, 'p1');
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 2 }),
    );
    settle(g);
    expect(lifeOf(g, 'p1')).toBe(before + 2);
  });

  test('a TREASURE token gains nothing — a token, but not a creature', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    const before = gains(g);
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: TREASURE_TOKEN.scryfallId, count: 1 }),
    );
    settle(g);
    expect(gains(g)).toBe(before);
  });

  /**
   * ⚠️ THE BREAK TEST FOR THE TWO-DEF RULE. The same script with the token def
   * removed misses every token — which is exactly the Soul Warden a one-def
   * version would ship, and why this file's token cases are load-bearing.
   */
  test('the CardsMoved def ALONE misses tokens — the token def is the other half of the card', () => {
    const cardDefOnly: CardScript = {
      ...SOUL_WARDEN_SCRIPT,
      triggers: (SOUL_WARDEN_SCRIPT.triggers ?? []).filter((t) => t.abilityId === 'etb-card'),
    };
    const g = game(cardDefOnly);
    put(g, 'p1', WARDEN);
    settle(g);
    const before = lifeOf(g, 'p1');
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }),
    );
    settle(g);
    expect(lifeOf(g, 'p1'), 'the crippled variant must miss the token').toBe(before);
  });

  /**
   * ⚠️ THE APNAP-PREFIX RULE (D158's drain rewrite), pinned. One creature
   * enters under three wardens split 1 (active player) / 2 (opponent): the
   * active player's single trigger has its stack position settled whatever the
   * opponent answers, so it goes on FIRST; the opponent is then asked to order
   * their two. The old drain stacked nothing until every group was a singleton,
   * which would have put the active player's trigger on top — CR 603.3b
   * reversed.
   */
  test('APNAP with a choice: the active player’s trigger stacks first, then the opponent is asked', () => {
    const g = startedGame({
      players: 2,
      decks: [
        [WARDEN, 'Grizzly Bears'],
        ['Essence Warden', WARDEN],
      ],
      scripts: createRegistry([SOUL_WARDEN_SCRIPT, ESSENCE_WARDEN_SCRIPT]),
    });
    put(g, 'p1', WARDEN);
    put(g, 'p2', 'Essence Warden');
    put(g, 'p2', WARDEN);
    settle(g);
    const p1Before = lifeOf(g, 'p1');
    const p2Before = lifeOf(g, 'p2');
    const logAt = g.log.length;
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(lifeOf(g, 'p1')).toBe(p1Before + 1);
    expect(lifeOf(g, 'p2')).toBe(p2Before + 2);
    const tail = g.log.slice(logAt);
    expect(
      tail.some(
        (e) =>
          e.body.t === 'AwaitingSet' &&
          e.body.awaiting?.kind === 'orderTriggers' &&
          e.body.awaiting.player === 'p2',
      ),
      'the opponent must have been ASKED',
    ).toBe(true);
    const stacked = tail.filter((e) => e.body.t === 'AbilityPutOnStack');
    expect(stacked).toHaveLength(3);
    expect(stacked[0]?.body.t === 'AbilityPutOnStack' ? stacked[0].body.obj.controller : null).toBe('p1');
  });

  test('a game full of warden triggers still replays to the same hash', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    put(g, 'p1', 'Grizzly Bears');
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 2 }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
