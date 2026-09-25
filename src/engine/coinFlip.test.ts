// D534 - COIN FLIP (CR 705). `Flip a coin.` draws from the game's RNG and leaves the manual tool's own `CoinFlipped`
// marker (the flipper calls heads, so the flip is won on heads); `If you win the flip, X.` / `If you lose the flip, Y.`
// are gated clauses on `flipWon` / `flipLost`, read off the resolution - or off the continuation when a clause between
// asks. What is proven here: the parse (Winter Sky and Stitch in Time read whole); Winter Sky's two branches, each found
// by trying seeds until the flip went that way; a verdict that crosses a question (a scry between the flip and its gated
// clause); the replay hash on every game - the RNG draw is recorded, so a replay flips the same coin.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import { VIASHINO_SANDSWIMMER } from '../data/fixtures/engineCards';

const SCRY_BETWEEN = 'Flip a coin. Scry 1. If you lose the flip, you lose 2 life.';
const REG = createRegistry([
  {
    oracleId: VIASHINO_SANDSWIMMER.oracleId,
    name: VIASHINO_SANDSWIMMER.name,
    triggers: [
      {
        abilityId: 'etb-flip-proof',
        text: SCRY_BETWEEN,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        targets: vocabularyTargets(SCRY_BETWEEN),
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => 'the flip across a scry',
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, vocabularyEffects(SCRY_BETWEEN, VIASHINO_SANDSWIMMER.name), vocabularyTargets(SCRY_BETWEEN)),
      },
    ] as NonNullable<CardScript['triggers']>,
  },
]);

const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const lastFlip = (g: Game): boolean | null => {
  const e = [...g.log].reverse().find((x) => x.body.t === 'CoinFlipped');
  return e && e.body.t === 'CoinFlipped' ? e.body.heads : null;
};

function game(seed: string): Game {
  const lands = (n: number) => Array.from({ length: n }, () => 'Mountain');
  const g = startedGame({
    players: 2,
    seed,
    decks: [['Winter Sky', 'Stitch in Time', 'Viashino Sandswimmer', 'Grizzly Bears', ...lands(12)], ['Grizzly Bears', ...lands(12)]],
    scripts: REG,
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  return g;
}

/** Winter Sky cast on turn 3 under `seed`, with a Bears on each side. */
function winterSky(seed: string): { g: Game; mine: InstanceId; theirs: InstanceId; life: [number, number]; hands: [number, number] } {
  const g = game(seed);
  const sky = put(g, 'p1', 'Winter Sky', 'hand');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  main(g, 3);
  const life: [number, number] = [g.state.players.p1?.life ?? 0, g.state.players.p2?.life ?? 0];
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  const hands: [number, number] = [(g.state.zones.hand.p1 ?? []).length - 1, (g.state.zones.hand.p2 ?? []).length];
  must(g.submit({ t: 'CastSpell', player: 'p1', card: sky, targets: [] }));
  settle(g);
  return { g, mine, theirs, life, hands };
}

describe('D534 - coin flip', () => {
  test('the parse: the flip and both gated branches read whole', () => {
    expect(faceNamed('Winter Sky').effectMode).toBe('auto');
    expect(faceNamed('Winter Sky').effects.map((e) => [e.kind, e.gate?.[0]?.kind ?? null])).toEqual([
      ['flipCoin', null],
      ['damageEach', 'flipWon'],
      ['draw', 'flipLost'],
    ]);
    expect(faceNamed('Stitch in Time').effectMode).toBe('auto');
    expect(vocabularyEffects('Flip a coin.', 'X')[0]).toMatchObject({ kind: 'flipCoin' });
  });

  test("Winter Sky's won branch deals the damage and its lost branch draws - each found by seed", () => {
    let seen = { won: false, lost: false };
    for (let k = 1; k <= 40 && !(seen.won && seen.lost); k++) {
      const { g, mine, theirs, life, hands } = winterSky('flip-' + k);
      const won = lastFlip(g);
      expect(won, 'the flip happened').not.toBeNull();
      if (won) {
        seen = { ...seen, won: true };
        expect(g.state.players.p1?.life).toBe(life[0] - 1);
        expect(g.state.players.p2?.life).toBe(life[1] - 1);
        expect(g.state.cards[mine]?.damage).toBe(1);
        expect(g.state.cards[theirs]?.damage).toBe(1);
        expect((g.state.zones.hand.p1 ?? []).length, 'no draw on a win').toBe(hands[0]);
      } else {
        seen = { ...seen, lost: true };
        expect(g.state.players.p1?.life, 'no damage on a loss').toBe(life[0]);
        expect((g.state.zones.hand.p1 ?? []).length).toBe(hands[0] + 1);
        expect((g.state.zones.hand.p2 ?? []).length).toBe(hands[1] + 1);
      }
      expect(stateHash(replay(g.log, g.seed)), 'the replay flips the same coin').toBe(g.hash());
    }
    expect(seen, 'both branches within forty seeds').toEqual({ won: true, lost: true });
  });

  test('the verdict crosses a question: a scry between the flip and its gated clause', () => {
    let seen = { won: false, lost: false };
    for (let k = 1; k <= 40 && !(seen.won && seen.lost); k++) {
      const g = game('scry-' + k);
      const swimmer = put(g, 'p1', 'Viashino Sandswimmer', 'graveyard');
      main(g, 3);
      const life0 = g.state.players.p1?.life ?? 0;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: swimmer, to: { kind: 'battlefield', player: 'p1' } }));
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
      const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
      must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: shown, toBottom: [] }));
      settle(g);
      const won = lastFlip(g);
      if (won) seen = { ...seen, won: true };
      else seen = { ...seen, lost: true };
      expect(g.state.players.p1?.life, won ? 'a win costs nothing' : 'a loss costs 2 life, after the scry').toBe(won ? life0 : life0 - 2);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
    expect(seen).toEqual({ won: true, lost: true });
  });
});
