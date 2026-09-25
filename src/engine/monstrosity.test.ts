// D533 - MONSTROSITY AND ADAPT (CR 701.37, 701.46). `Monstrosity N.` puts N +1/+1 counters on the source and makes it
// monstrous - once: a monstrous permanent gets nothing more; `monstrous` stays until the permanent leaves; `When ~
// becomes monstrous` triggers on the marker. `Adapt N.` puts N +1/+1 counters on a source with none. What is proven here:
// the parse of both forms (and `Monstrosity X` left unread); Nessian Asp's monstrosity in play - the counters and the
// mark, a second activation changing nothing, the mark gone once the Asp leaves and comes back; Keepsake Gorgon's
// becomes-monstrous head firing on the first activation and not on the second; Skitter Eel adapting once; the replay
// hash on each game.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';
import { KEEPSAKE_GORGON, NESSIAN_ASP, SKITTER_EEL } from '../data/fixtures/engineCards';

/** The first activated line of a card, its vocabulary payload the one under proof. */
function act(card: { readonly oracleId: string; readonly name: string }, line: string, payload: string): NonNullable<CardScript['activated']>[number] {
  const V = vocabularyEffects(payload, card.name);
  const T = vocabularyTargets(payload);
  return { ref: `${card.oracleId}#a0`, text: line, resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, V, T) };
}
const GORGON_PAYLOAD = 'Destroy target non-Gorgon creature an opponent controls.';
const REG = createRegistry([
  { oracleId: NESSIAN_ASP.oracleId, name: NESSIAN_ASP.name, activated: [act(NESSIAN_ASP, '{6}{G}: Monstrosity 4.', 'Monstrosity 4.')] },
  {
    oracleId: KEEPSAKE_GORGON.oracleId,
    name: KEEPSAKE_GORGON.name,
    activated: [act(KEEPSAKE_GORGON, '{5}{B}{B}: Monstrosity 1.', 'Monstrosity 1.')],
    triggers: [
      {
        abilityId: 'becomes-monstrous',
        text: 'When this creature becomes monstrous, ' + GORGON_PAYLOAD,
        event: 'BecameMonstrous',
        activeZones: ['battlefield'],
        optional: false,
        targets: vocabularyTargets(GORGON_PAYLOAD),
        matches: (_ctx, self, ev) => ev.t === 'BecameMonstrous' && ev.card === self,
        label: () => 'Keepsake Gorgon - destroy a non-Gorgon creature',
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, vocabularyEffects(GORGON_PAYLOAD, KEEPSAKE_GORGON.name), vocabularyTargets(GORGON_PAYLOAD)),
      },
    ],
  },
  { oracleId: SKITTER_EEL.oracleId, name: SKITTER_EEL.name, activated: [act(SKITTER_EEL, '{2}{U}: Adapt 2.', 'Adapt 2.')] },
]);

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const pay = (g: Game, player: PlayerId, symbols: string) => {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: s as 'G' | 'B' | 'U' | 'C', amount: 1 }));
};
const activate = (g: Game, card: InstanceId, symbols: string) => {
  pay(g, 'p1', symbols);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: 0 }));
};
const plusOnes = (g: Game, card: InstanceId) => g.state.cards[card]?.counters['+1/+1'] ?? 0;

function game(): Game {
  const lands = (n: number) => Array.from({ length: n }, () => 'Forest');
  const g = startedGame({
    players: 2,
    decks: [['Nessian Asp', 'Keepsake Gorgon', 'Skitter Eel', ...lands(12)], ['Cyclops of One-Eyed Pass', 'Keepsake Gorgon', ...lands(10)]],
    scripts: REG,
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  return g;
}

describe('D533 - monstrosity and adapt', () => {
  test('the parse: Monstrosity N and Adapt N read; Monstrosity X stays unread', () => {
    expect(vocabularyEffects('Monstrosity 4.', 'X')[0]).toMatchObject({ kind: 'monstrosity', amount: 4, self: true });
    expect(vocabularyEffects('Adapt 2.', 'X')[0]).toMatchObject({ kind: 'adapt', amount: 2, self: true });
    expect(parseEffects('Monstrosity X.', 'X', true).mode).not.toBe('auto');
  });

  test("Nessian Asp becomes monstrous once, and forgets it when it leaves", () => {
    const g = game();
    const asp = put(g, 'p1', 'Nessian Asp');
    main(g, 3);
    activate(g, asp, 'GCCCCCC');
    settle(g);
    expect(plusOnes(g, asp)).toBe(4);
    expect(g.state.cards[asp]?.monstrous).toBe(true);
    activate(g, asp, 'GCCCCCC');
    settle(g);
    expect(plusOnes(g, asp), 'a monstrous Asp gets nothing more').toBe(4);
    expect(g.log.filter((e) => e.body.t === 'BecameMonstrous').length).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: asp, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: asp, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.cards[asp]?.monstrous, 'a new object is not monstrous').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Keepsake Gorgon's becomes-monstrous head fires on the first activation only", () => {
    const g = game();
    const gorgon = put(g, 'p1', 'Keepsake Gorgon');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    main(g, 3);
    activate(g, gorgon, 'BBCCCCC');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind, 'the head destroyed the Cyclops').toBe('graveyard');
    expect(g.state.cards[gorgon]?.monstrous).toBe(true);
    const fires = g.log.filter((e) => e.body.t === 'BecameMonstrous').length;
    activate(g, gorgon, 'BBCCCCC');
    settle(g);
    expect(g.log.filter((e) => e.body.t === 'BecameMonstrous').length, 'no second mark, so no second fire').toBe(fires);
    expect(g.state.priority.awaiting, 'nothing asks for a target').toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Skitter Eel adapts once', () => {
    const g = game();
    const eel = put(g, 'p1', 'Skitter Eel');
    main(g, 3);
    activate(g, eel, 'UCC');
    settle(g);
    expect(plusOnes(g, eel)).toBe(2);
    activate(g, eel, 'UCC');
    settle(g);
    expect(plusOnes(g, eel), 'an Eel with counters does not adapt again').toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
