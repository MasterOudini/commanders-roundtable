import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { TREASURE_TOKEN, SOLDIER_TOKEN } from '../data/fixtures/engineCards';
import {
  advanceUntil,
  battlefieldOf,
  findAnywhere,
  idsIn,
  must,
  put,
  startedGame,
} from './testing/harness';

// Tier 3 — the manual tools. NOT enforced, all logged.
//
// ⚠️ Every tool goes through the same append-only log as an automatic rules
// action and carries a `ManualAction` record of what the player asked for. In a
// friends game that is a TRUST feature: the log always shows what was automated
// and what was hand-waved. It is also what keeps replay and rewind working
// across a game that used them, which the last test in this file proves.

describe('Tier-3 manual tools', () => {
  test('every manual action leaves a ManualAction marker and a manual log line', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const before = game.log.length;
    put(game, 'p1', 'Sol Ring');
    const produced = game.log.slice(before);
    expect(produced.some((e) => e.body.t === 'ManualAction')).toBe(true);
    const line = game.state.narration[game.state.narration.length - 1];
    expect(line?.manual).toBe(true);
    expect(produced.every((e) => e.cause.kind === 'intent' || e.cause.kind === 'rules')).toBe(true);
  });

  test('move any card between any zones', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = findAnywhere(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'exile', player: 'p2' } }));
    expect(idsIn(game, 'p2', 'exile')).toContain(angel);
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'command', player: 'p1' } }));
    expect(idsIn(game, 'p1', 'command')).toContain(angel);
  });

  test('create tokens, and they vanish when moved off the battlefield', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 3 }));
    const tokens = battlefieldOf(game, 'p1').filter((id) => game.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(3);
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: tokens[0] as string,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    expect(game.state.cards[tokens[0] as string]).toBeUndefined();
    expect(battlefieldOf(game, 'p1').filter((id) => game.state.cards[id]?.isToken)).toHaveLength(2);
  });

  test('a token printing that is not in the database is refused', () => {
    const game = startedGame();
    const result = game.submit({ t: 'ManualCreateToken', player: 'p1', printingId: 'nope', count: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('noSuchToken');
  });

  test('arbitrary named counters', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: ring, kind: 'charge', delta: 4 }));
    expect(game.state.cards[ring]?.counters).toEqual({ charge: 4 });
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: ring, kind: 'charge', delta: -4 }));
    expect(game.state.cards[ring]?.counters).toEqual({});
  });

  test('life and poison adjust in both directions', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -13 }));
    expect(game.state.players['p2']?.life).toBe(27);
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: +5 }));
    expect(game.state.players['p2']?.life).toBe(32);
    must(game.submit({ t: 'ManualSetPoison', player: 'p1', target: 'p2', delta: 3 }));
    expect(game.state.players['p2']?.poison).toBe(3);
  });

  test('ten poison counters lose the game', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualSetPoison', player: 'p1', target: 'p2', delta: 10 }));
    expect(game.state.players['p2']?.lossReason).toBe('poison');
  });

  test('mana can be added and emptied by hand', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    expect(game.state.players['p1']?.pool.G).toBe(3);
    must(game.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    expect(game.state.players['p1']?.pool.G).toBe(0);
  });

  test('tap and untap anything', () => {
    const game = startedGame({ decks: [['Sol Ring', 'Forest']] });
    const ring = put(game, 'p1', 'Sol Ring');
    const forest = put(game, 'p1', 'Forest');
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring, forest], tapped: true }));
    expect(game.state.cards[ring]?.tapped).toBe(true);
    expect(game.state.cards[forest]?.tapped).toBe(true);
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: false }));
    expect(game.state.cards[ring]?.tapped).toBe(false);
  });

  test('turn a permanent face down and back up', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetFaceDown', player: 'p1', card: angel, faceDown: true }));
    expect(game.state.cards[angel]?.faceDown).toBe(true);
    must(game.submit({ t: 'ManualSetFaceDown', player: 'p1', card: angel, faceDown: false }));
    expect(game.state.cards[angel]?.faceDown).toBe(false);
  });

  test('flip a double-faced card', () => {
    const game = startedGame({ decks: [['Delver of Secrets // Insectile Aberration']] });
    const delver = put(game, 'p1', 'Delver of Secrets // Insectile Aberration');
    expect(game.state.cards[delver]?.faceIndex).toBe(0);
    must(game.submit({ t: 'ManualFlipFace', player: 'p1', card: delver }));
    expect(game.state.cards[delver]?.faceIndex).toBe(1);
  });

  test('a single-faced card cannot be flipped', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    expect(game.submit({ t: 'ManualFlipFace', player: 'p1', card: ring }).ok).toBe(false);
  });

  test('attach and unattach', () => {
    const game = startedGame({ decks: [['Grizzly Bears', 'Lightning Greaves']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const greaves = put(game, 'p1', 'Lightning Greaves');
    must(game.submit({ t: 'ManualAttach', player: 'p1', card: greaves, to: bear }));
    expect(game.state.cards[bear]?.attachments).toEqual([greaves]);
    must(game.submit({ t: 'ManualAttach', player: 'p1', card: greaves, to: null }));
    expect(game.state.cards[bear]?.attachments).toEqual([]);
  });

  test('change control of a permanent', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetController', player: 'p1', card: bear, controller: 'p2' }));
    expect(game.state.cards[bear]?.controller).toBe('p2');
    expect(battlefieldOf(game, 'p2')).toContain(bear);
  });

  test('reveal cards to everyone or to yourself', () => {
    const game = startedGame();
    const hand = idsIn(game, 'p1', 'hand');
    must(game.submit({ t: 'ManualReveal', player: 'p1', cards: hand.slice(0, 2), toAll: true }));
    expect(game.state.cards[hand[0] as string]?.revealedTo).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  test('peek at the top of your own library', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 3 }));
    const library = idsIn(game, 'p1', 'library');
    const top = library.slice(library.length - 3);
    for (const id of top) expect(game.state.cards[id]?.revealedTo).toEqual(['p1']);
    // ⚠️ Only the peeker. Everyone else must still see nothing.
    for (const id of top) expect(game.state.cards[id]?.revealedTo).not.toContain('p2');
  });

  test('draw and shuffle by hand', () => {
    const game = startedGame();
    const before = idsIn(game, 'p1', 'hand').length;
    must(game.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 3 }));
    expect(idsIn(game, 'p1', 'hand')).toHaveLength(before + 3);
    const order = idsIn(game, 'p1', 'library').join(',');
    must(game.submit({ t: 'ManualShuffle', player: 'p1', target: 'p1' }));
    expect(idsIn(game, 'p1', 'library').join(',')).not.toBe(order);
  });

  test('making a creature your commander starts a fresh damage tally', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetCommander', player: 'p1', card: bear, isCommander: true }));
    expect(game.state.cards[bear]?.isCommander).toBe(true);
    expect(game.state.players['p1']?.commanderIds).toContain(bear);
  });

  test('dice and coins are seeded, logged and replayable', () => {
    const a = startedGame({ seed: 'dice' });
    const b = startedGame({ seed: 'dice' });
    must(a.submit({ t: 'RollDice', player: 'p1', sides: 20 }));
    must(b.submit({ t: 'RollDice', player: 'p1', sides: 20 }));
    const rollA = a.log.find((e) => e.body.t === 'DiceRolled');
    const rollB = b.log.find((e) => e.body.t === 'DiceRolled');
    expect(rollA?.body).toEqual(rollB?.body);
    must(a.submit({ t: 'FlipCoin', player: 'p1' }));
    expect(a.log.some((e) => e.body.t === 'CoinFlipped')).toBe(true);
    expect(stateHash(replay(a.log, a.seed))).toBe(a.hash());
  });

  test('a die with a silly number of sides is refused', () => {
    const game = startedGame();
    expect(game.submit({ t: 'RollDice', player: 'p1', sides: 1 }).ok).toBe(false);
    expect(game.submit({ t: 'RollDice', player: 'p1', sides: 100_000 }).ok).toBe(false);
  });

  /**
   * ⚠️ THE POINT OF THE WHOLE TIER-3 DESIGN. A game that mixed automatic rules
   * and hand-waved manual tools replays to a bit-identical state, because both
   * kinds of change went through the same append-only log.
   */
  test('replay after a MIXED automatic/manual game yields an identical hash', () => {
    const game = startedGame({
      players: 4,
      decks: [['Forest', 'Grizzly Bears', 'Sol Ring'], ['Mountain'], [], []],
      librarySize: 40,
    });
    put(game, 'p1', 'Forest');
    put(game, 'p1', 'Forest');
    must(game.submit({ t: 'ManualCreateToken', player: 'p2', printingId: TREASURE_TOKEN.scryfallId, count: 2 }));
    must(game.submit({ t: 'ManualSetLife', player: 'p3', target: 'p4', delta: -7 }));
    must(game.submit({ t: 'RollDice', player: 'p4', sides: 6 }));
    const bears = findAnywhere(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    advanceUntil(game, (s) => s.turn.turnNumber === 4, 20_000);
    must(game.submit({ t: 'ManualShuffle', player: 'p1', target: 'p1' }));
    must(game.submit({ t: 'FlipCoin', player: 'p2' }));

    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
    expect(game.log.some((e) => e.body.t === 'ManualAction')).toBe(true);
    expect(game.log.some((e) => e.cause.kind === 'rules')).toBe(true);
  });
});

describe('group rewind', () => {
  test('a rewind needs every living player to agree', () => {
    const game = startedGame({ players: 3 });
    must(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: 5 }));
    expect(game.state.priority.awaiting?.kind).toBe('rewindVote');
    must(game.submit({ t: 'VoteRewind', player: 'p2', agree: true }));
    expect(game.state.priority.awaiting?.kind).toBe('rewindVote');
    must(game.submit({ t: 'VoteRewind', player: 'p3', agree: true }));
    expect(game.state.priority.awaiting?.kind).not.toBe('rewindVote');
  });

  test('one refusal cancels it', () => {
    const game = startedGame({ players: 3 });
    must(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: 5 }));
    must(game.submit({ t: 'VoteRewind', player: 'p2', agree: false }));
    expect(game.log.some((e) => e.body.t === 'RewindCancelled')).toBe(true);
    expect(game.state.priority.awaiting?.kind).not.toBe('rewindVote');
  });

  test('rewinding out of range is refused', () => {
    const game = startedGame();
    expect(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: 999_999 }).ok).toBe(false);
    expect(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: 0 }).ok).toBe(false);
  });

  /**
   * ⚠️ Rewind re-folds a PREFIX of the log; it is not a reducer case and it does
   * not truncate history. `replay(log)` still reproduces `state` afterwards,
   * which is what keeps every downstream guarantee intact.
   */
  test('rewinding restores the earlier board exactly', () => {
    const game = startedGame({ decks: [['Sol Ring', 'Serra Angel']] });
    const ring = put(game, 'p1', 'Sol Ring');
    const mark = game.log.length;
    const hashBefore = game.hash();

    put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -20 }));
    expect(game.hash()).not.toBe(hashBefore);

    expect(game.rewind(mark)).toBe(true);
    expect(game.hash()).toBe(hashBefore);
    expect(battlefieldOf(game, 'p1')).toEqual([ring]);
    expect(game.state.players['p2']?.life).toBe(40);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });

  test('history keeps everything, including the RewoundTo marker', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const mark = game.log.length;
    put(game, 'p1', 'Sol Ring');
    const historyBefore = game.history.length;
    game.rewind(mark);
    expect(game.log.length).toBe(mark);
    expect(game.history.length).toBe(historyBefore + 1);
    expect(game.history[game.history.length - 1]?.body.t).toBe('RewoundTo');
  });

  test('play continues normally after a rewind', () => {
    const game = startedGame({ decks: [['Sol Ring', 'Forest']] });
    const mark = game.log.length;
    put(game, 'p1', 'Sol Ring');
    game.rewind(mark);
    put(game, 'p1', 'Forest');
    expect(battlefieldOf(game, 'p1')).toHaveLength(1);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
    advanceUntil(game, (s) => s.turn.turnNumber === 3, 20_000);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});
