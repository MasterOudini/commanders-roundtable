// D531 - CONTROL WITH A DURATION AND THE EXCHANGE (CR 611.2b, 701.10). `Gain control of target creature.` has no end;
// `... for as long as ~ remains on the battlefield.` / `... for as long as you control ~.` end with the SOURCE (D453's
// memory on the permanent, with a mode and the taker, read by the state-based sweep); `Exchange control of target A and
// target B.` swaps two controllers, or does nothing when one is gone or both are one player's. What is proven here: the
// parse of every form; Keiga's dies trigger taking the Cyclops for good (still p1's a turn later); Sower of Temptation
// taking it for as long as Sower stays (back to p2 the moment Sower leaves); Master Thief taking an artifact the same way
// (the `while you control` mode); Political Trickery exchanging two lands; the replay hash on each game.
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
import { KEIGA_THE_TIDE_STAR, MASTER_THIEF, SOWER_OF_TEMPTATION } from '../data/fixtures/engineCards';

type TriggerDef = NonNullable<CardScript['triggers']>[number];
/** An enters or dies trigger as the row maker generates one, its payload the vocabulary's. */
function trig(card: { readonly name: string }, id: string, dies: boolean, payload: string): TriggerDef {
  const V = vocabularyEffects(payload, card.name);
  const T = vocabularyTargets(payload);
  return {
    abilityId: id,
    text: payload,
    event: 'CardsMoved',
    activeZones: ['battlefield'],
    optional: false,
    ...(dies ? { looksBack: true } : {}),
    targets: T,
    matches: (_ctx, self, ev) =>
      ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && (dies ? m.from.kind === 'battlefield' && m.to.kind === 'graveyard' : m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
    label: () => `${card.name} - ${payload}`,
    resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, V, T),
  };
}
const REG = createRegistry([
  { oracleId: KEIGA_THE_TIDE_STAR.oracleId, name: KEIGA_THE_TIDE_STAR.name, triggers: [trig(KEIGA_THE_TIDE_STAR, 'dies-1', true, 'Gain control of target creature.')] },
  { oracleId: SOWER_OF_TEMPTATION.oracleId, name: SOWER_OF_TEMPTATION.name, triggers: [trig(SOWER_OF_TEMPTATION, 'etb-1', false, 'Gain control of target creature for as long as ~ remains on the battlefield.')] },
  { oracleId: MASTER_THIEF.oracleId, name: MASTER_THIEF.name, triggers: [trig(MASTER_THIEF, 'etb-0', false, 'Gain control of target artifact for as long as you control ~.')] },
]);

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const aimAt = (g: Game, id: InstanceId) => { advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000); must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id }] })); };

function game(): Game {
  const lands = (n: number) => Array.from({ length: n }, () => 'Island');
  const g = startedGame({
    players: 2,
    decks: [['Keiga, the Tide Star', 'Sower of Temptation', 'Master Thief', 'Political Trickery', ...lands(12)], ['Cyclops of One-Eyed Pass', 'Sol Ring', 'Forest', 'Forest', ...lands(8)]],
    scripts: REG,
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  return g;
}

describe('D531 - control with a duration, and the exchange', () => {
  test('the parse: no end, while the source stays, while you control it, the exchange', () => {
    expect(faceNamed('Political Trickery').effects.map((e) => e.kind)).toEqual(['exchangeControl']);
    expect(faceNamed('Political Trickery').effects[0]?.otherTargetIndex).toBe(1);
    expect(faceNamed('Political Trickery').effectMode).toBe('auto');
    const v = (t: string) => vocabularyEffects(t, 'X')[0];
    expect(v('Gain control of target creature.')).toMatchObject({ kind: 'control', controlFor: 'indefinite' });
    expect(v('Gain control of target creature for as long as ~ remains on the battlefield.')).toMatchObject({ kind: 'control', controlFor: 'whileOnBattlefield' });
    expect(v('Gain control of target artifact for as long as you control ~.')).toMatchObject({ kind: 'control', controlFor: 'whileControlled' });
    expect(v('Gain control of target creature until end of turn.')).toMatchObject({ kind: 'control', controlFor: null });
    expect(v('Exchange control of ~ and target creature.')).toMatchObject({ kind: 'exchangeControl', self: true });
  });

  test("Keiga's dies trigger takes the Cyclops for good", () => {
    const g = game();
    const keiga = put(g, 'p1', 'Keiga, the Tide Star');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    main(g, 3);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: keiga, to: { kind: 'graveyard', player: 'p1' } }));
    aimAt(g, cyclops);
    settle(g);
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    expect(g.state.cards[cyclops]?.controlledVia).toBeUndefined();
    main(g, 5);
    expect(g.state.cards[cyclops]?.controller, 'no cleanup gives it back').toBe('p1');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Sower of Temptation holds the Cyclops for as long as Sower stays', () => {
    const g = game();
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    const sower = put(g, 'p1', 'Sower of Temptation', 'graveyard');
    main(g, 3);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sower, to: { kind: 'battlefield', player: 'p1' } }));
    aimAt(g, cyclops);
    settle(g);
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    expect(g.state.cards[cyclops]?.controlledVia?.mode).toBe('whileOnBattlefield');
    main(g, 5);
    expect(g.state.cards[cyclops]?.controller, 'still held a turn later').toBe('p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sower, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.controller, 'back to p2 the moment Sower left').toBe('p2');
    expect(g.state.cards[cyclops]?.controlledVia).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Master Thief holds an artifact for as long as p1 controls it', () => {
    const g = game();
    const ring = put(g, 'p2', 'Sol Ring');
    const thief = put(g, 'p1', 'Master Thief', 'graveyard');
    main(g, 3);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: thief, to: { kind: 'battlefield', player: 'p1' } }));
    aimAt(g, ring);
    settle(g);
    expect(g.state.cards[ring]?.controller).toBe('p1');
    expect(g.state.cards[ring]?.controlledVia).toMatchObject({ mode: 'whileControlled', by: 'p1', revertTo: 'p2' });
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: thief, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[ring]?.controller).toBe('p2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Political Trickery exchanges two lands', () => {
    const g = game();
    const trick = put(g, 'p1', 'Political Trickery', 'hand');
    const mine = put(g, 'p1', 'Island');
    const theirs = put(g, 'p2', 'Forest');
    main(g, 3);
    for (const s of 'CCU') must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'U' | 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: trick, targets: [{ kind: 'card', id: mine }, { kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.controller).toBe('p2');
    expect(g.state.cards[theirs]?.controller).toBe('p1');
    expect(g.log.filter((e) => e.body.t === 'ControlGained').length).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
