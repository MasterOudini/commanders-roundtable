// D475 - THE EMBLEM (CR 114). A player who gets an emblem gets an object in their command zone with the abilities
// of the emblem printing the card quotes - the database carries 138 such printings (`Emblem — Gideon`, "Creatures
// you control get +1/+1."). What is proven here, before any emblem is rowed:
//   - the fold lifts `You get an emblem with "Q"` out like a token's quote; the vocabulary reads a BAKED emblem (a
//     rowed printing, its abilities a shipped script's) and REFUSES one the bake does not hold (the quote is the
//     card's own text - D90, D473's rule);
//   - `ManualCreateEmblem` puts the printing into the actor's command zone; it is no permanent, never castable;
//   - a STATIC on the emblem applies from the command zone (the anthem: a Bears reads 3/3);
//   - a TRIGGER on the emblem fires from the command zone (the upkeep ping);
//   - the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { foldTokenQuotes } from '../data/tokenParse';
import { CHANDRA_AWAKENED_INFERNO_EMBLEM, GIDEON_ALLY_OF_ZENDIKAR_EMBLEM } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const ANTHEM_TEXT = 'Creatures you control get +1/+1.';
const PING_TEXT = 'At the beginning of your upkeep, this emblem deals 1 damage to you.';
if (GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.faces[0]?.oracleText !== ANTHEM_TEXT) throw new Error('re-read the Gideon emblem (D90)');
if (CHANDRA_AWAKENED_INFERNO_EMBLEM.faces[0]?.oracleText !== PING_TEXT) throw new Error('re-read the Chandra emblem (D90)');

/** The Gideon emblem's anthem, as a generated row would write it - from the COMMAND zone. */
const ANTHEM_EMBLEM: CardScript = {
  oracleId: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.oracleId,
  name: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem',
      text: ANTHEM_TEXT,
      layer: 'ptModify',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};

const PING_VOCAB = vocabularyEffects('~ deals 1 damage to you.', CHANDRA_AWAKENED_INFERNO_EMBLEM.name);
const PING_TARGETS = vocabularyTargets('~ deals 1 damage to you.');
/** The Chandra emblem's upkeep ping, as a generated row would write it - from the COMMAND zone. */
const PING_EMBLEM: CardScript = {
  oracleId: CHANDRA_AWAKENED_INFERNO_EMBLEM.oracleId,
  name: CHANDRA_AWAKENED_INFERNO_EMBLEM.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PING_TEXT,
      event: 'StepBegan',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Chandra, Awakened Inferno Emblem - this emblem deals 1 damage to you.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, PING_VOCAB, PING_TARGETS),
    },
  ],
};

function emblemOf(g: Game, player: 'p1' | 'p2', printingId: string): InstanceId {
  const id = (g.state.zones.command[player] ?? []).find((c) => g.state.cards[c]?.printingId === printingId);
  if (!id) throw new Error('no such emblem in the command zone');
  return id;
}

describe('D475 - the emblem', () => {
  test('the quote folds like a token quote; the vocabulary reads a baked emblem and refuses an unbaked one', () => {
    const f = foldTokenQuotes(`−4: You get an emblem with "${ANTHEM_TEXT}"`);
    expect(f).toEqual({ text: '−4: You get an emblem with #q0#.', quotes: [ANTHEM_TEXT] });
    // The Gideon emblem is rowed (its anthem a shipped script, run from the command zone), so the bake holds it.
    const read = parseEffects(`You get an emblem with "${ANTHEM_TEXT}"`, 'Gideon, Ally of Zendikar', true);
    expect(read.mode).toBe('auto');
    expect(read.effects[0]?.kind).toBe('createEmblem');
    expect(read.effects[0]?.token?.printingId).toBe(GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.scryfallId);
    // No shipped script runs Jaya Ballard's emblem, so the table holds no entry and the sentence stays unread (D90).
    expect(parseEffects('You get an emblem with "You may cast instant and sorcery spells from your graveyard. If a spell cast this way would be put into your graveyard, exile it instead."', 'Jaya Ballard', true).mode).toBe('manual');
  });

  test('an emblem sits in the command zone, is no permanent and is never castable', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], []], scripts: createRegistry([ANTHEM_EMBLEM]) });
    holdEverywhere(g);
    must(g.submit({ t: 'ManualCreateEmblem', player: 'p1', printingId: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.scryfallId }));
    const emblem = emblemOf(g, 'p1', GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.scryfallId);
    expect(g.state.cards[emblem]?.zone).toEqual({ kind: 'command', player: 'p1' });
    expect(g.state.cards[emblem]?.isToken).toBe(false);
    expect(g.state.zones.battlefield).not.toContain(emblem);
    expect(legalActions(g.state, ORACLE, g.deps.scripts, 'p1').some((a) => a.t === 'CastSpell' && a.card === emblem)).toBe(false);
  });

  test('the anthem applies from the command zone: a Bears reads 3/3 under the Gideon emblem', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([ANTHEM_EMBLEM]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const before = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect([before.power, before.toughness]).toEqual([2, 2]);
    must(g.submit({ t: 'ManualCreateEmblem', player: 'p1', printingId: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.scryfallId }));
    const after = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect([after.power, after.toughness]).toEqual([3, 3]);
    // p2's creatures are not the emblem owner's.
    const theirs = put(g, 'p2', 'Grizzly Bears');
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the upkeep ping fires from the command zone, and the game replays', () => {
    const g = startedGame({ players: 2, decks: [[], []], scripts: createRegistry([PING_EMBLEM]) });
    holdEverywhere(g);
    must(g.submit({ t: 'ManualCreateEmblem', player: 'p1', printingId: CHANDRA_AWAKENED_INFERNO_EMBLEM.scryfallId }));
    const life0 = g.state.players.p1?.life ?? 0;
    // p1's next upkeep is turn 3's; p2's turn-2 upkeep is not the emblem owner's.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.stack.length === 0 && s.pendingTriggers.length === 0, 40_000);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
    expect(g.state.players.p2?.life).toBe(40);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
