// D607 - THE SACRIFICED CREATURE'S NUMBER. `{1}, Sacrifice a creature: You gain life equal to the sacrificed creature's
// toughness.` (Disciple of Griselbrand, Miren, Ayli), `Fling deals damage equal to the sacrificed creature's power to any
// target.`, `Each opponent loses life equal to the sacrificed creature's power.` (Jarad), `Draw cards equal to the
// sacrificed creature's power ...` (Greater Good) - CR 608.2h: the number is the sacrificed permanent's as it last existed on
// the battlefield. The cost batch reads it as it charges the sacrifice (the activated cost, a spell's additional cost) and
// the stack object carries it (`StackObject.sacrificed`); the clause's amount is read off it as the object resolves. What
// is proven: the vocabulary reads the four shapes; a sacrificed 0/4 gains 4 life and a sacrificed 5/2 deals 5 damage, read
// as last known (the creature is in the graveyard by then); the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const GAIN = "You gain life equal to the sacrificed creature's toughness.";
const DAMAGE = "~ deals damage equal to the sacrificed creature's power to any target.";

/** Carnage Altar's printed `{3}, Sacrifice a creature:` activation, resolving the payload through the vocabulary. */
function altar(payload: string): CardScript {
  const card = ORACLE.byName('Carnage Altar');
  if (!card) throw new Error('Carnage Altar is not in the fixtures');
  const effects = vocabularyEffects(payload, 'Carnage Altar');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Carnage Altar',
    activated: [{
      ref: card.oracleId + '#a0',
      text: card.faces[0]?.oracleText ?? '',
      ...(targets.length > 0 ? { targets } : {}),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function altarGame(payload: string, fodderName: string): { g: Game; altarId: string; fodder: string } {
  const g = startedGame({ players: 2, decks: [['Carnage Altar', fodderName, ...TEN], ['Grizzly Bears', ...TEN]], scripts: createRegistry([altar(payload)]) });
  settle(g);
  holdEverywhere(g);
  const altarId = put(g, 'p1', 'Carnage Altar');
  const fodder = put(g, 'p1', fodderName);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, altarId, fodder };
}

describe('D607 - the sacrificed creature' + String.fromCharCode(39) + 's number', () => {
  test('the vocabulary reads the four shapes', () => {
    expect(vocabularyEffects(GAIN, 'Disciple of Griselbrand').map((e) => [e.kind, e.fromSacrificed])).toEqual([['gainLife', 'toughness']]);
    expect(vocabularyEffects(DAMAGE, 'Brion Stoutarm').map((e) => [e.kind, e.fromSacrificed, e.targetIndex])).toEqual([['damage', 'power', 0]]);
    expect(vocabularyEffects("Each opponent loses life equal to the sacrificed creature's power.", 'Jarad, Golgari Lich Lord').map((e) => [e.kind, e.fromSacrificed])).toEqual([['loseLife', 'power']]);
    expect(vocabularyEffects("Draw cards equal to the sacrificed creature's power.", 'Greater Good').map((e) => [e.kind, e.fromSacrificed])).toEqual([['draw', 'power']]);
    // A sacrifice that is an EFFECT (a verb price, a reflexive price, a clause) is not the cost the stamp records: unread.
    expect(() => vocabularyEffects("You may sacrifice a creature. If you do, you gain life equal to the sacrificed creature's toughness.", 'Bone Splinters')).toThrow();
    expect(() => vocabularyEffects("Sacrifice a creature, then each opponent loses life equal to the sacrificed creature's power.", 'Xathrid Demon')).toThrow();
  });

  test('a sacrificed 0/4 gains 4 life, read as it last existed', () => {
    const { g, altarId, fodder } = altarGame(GAIN, 'Steel Wall');
    const life0 = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altarId, abilityIndex: 0, sacrifice: [fodder] }));
    settle(g);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect((g.state.players['p1']?.life ?? 0) - life0).toBe(4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a sacrificed 5/2 deals 5 damage to the target', () => {
    const { g, altarId, fodder } = altarGame(DAMAGE, 'Cyclops of One-Eyed Pass');
    const life0 = g.state.players['p2']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altarId, abilityIndex: 0, sacrifice: [fodder], targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(life0 - (g.state.players['p2']?.life ?? 0)).toBe(5);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
