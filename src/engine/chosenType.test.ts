// D465 - THE CHOSEN CREATURE TYPE (CR 614.12): "As this ~ enters, choose a creature type." is the colour
// clause one noun over. The parser reads it into `OracleFace.choosesTypeOnEntry`, the entry site raises
// `chooseCreatureType` (the same one-at-a-time prompt as the colour), the handler stores the answer on
// `CardInstance.chosenType` after checking it against the oracle catalogue (`creatureTypes`, the changeling
// list), and the field clears with the battlefield fields so a permanent that leaves and returns is asked
// again. Proven on Shared Triumph with an inline static (what a generated row registers): the prompt, the
// answer, the Bears pumped and the Cyclops not, a misspelling and another player's answer refused, the
// bounce, the claim, the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { derive } from './derive';
import { engineCompleteness } from '../data/engineComplete';
import { parseChoosesTypeOnEntry } from '../data/replacementParse';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const TRIUMPH = ORACLE.byName('Shared Triumph');
if (!TRIUMPH) throw new Error('Shared Triumph is not in the fixtures');

const TRIUMPH_DEF: CardScript = {
  oracleId: TRIUMPH.oracleId,
  name: TRIUMPH.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: 'Creatures of the chosen type get +1/+1.',
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) =>
        chars.typeLine.types.includes('Creature') &&
        ctx.state.cards[candidate]?.zone.kind === 'battlefield' &&
        chars.typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? ''),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
const SCRIPTS = createRegistry([TRIUMPH_DEF]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function power(g: Game, id: InstanceId): number | null {
  return derive(g.state, g.deps.oracle, g.deps.scripts, id).power;
}

describe('D465 - the parse and the claim', () => {
  test('the clause is read into the face flag, anchored at both ends', () => {
    expect(TRIUMPH.faces[0]?.choosesTypeOnEntry).toBe(true);
    expect(TRIUMPH.faces[0]?.choosesColorOnEntry).toBe(false);
    expect(parseChoosesTypeOnEntry('As this enchantment enters, choose a creature type.')).toBe(true);
    expect(parseChoosesTypeOnEntry('As Shared Triumph enters, choose a creature type.')).toBe(true);
    expect(parseChoosesTypeOnEntry('As this enchantment enters, choose a creature type other than Human.')).toBe(false);
    expect(parseChoosesTypeOnEntry('As this artifact enters, choose a color and a creature type.')).toBe(false);
    expect(parseChoosesTypeOnEntry('As this enchantment enters, choose a color.')).toBe(false);
    expect(ORACLE.byName('Grizzly Bears')?.faces[0]?.choosesTypeOnEntry).toBe(false);
  });
  test('the entry clause is claimed by the flag, the static by the shipped script: the card reads whole', () => {
    expect(engineCompleteness(TRIUMPH.data)).toEqual({ complete: true, leftover: [] });
    // The flag alone claims only its own clause: with the shipped static gone the card would be one line short (D90).
  });
});

function armed(): { g: Game; triumph: InstanceId; bears: InstanceId; cyclops: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Shared Triumph', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const triumph = put(g, 'p1', 'Shared Triumph');
  return { g, triumph, bears, cyclops };
}

describe('D465 - the prompt and the answer (Shared Triumph)', () => {
  test('entering raises the prompt for the controller; the answer is stored and the static reads it', () => {
    const { g, triumph, bears, cyclops } = armed();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseCreatureType');
    if (awaiting?.kind !== 'chooseCreatureType') throw new Error('no prompt');
    expect(awaiting.player).toBe('p1');
    expect(awaiting.source).toBe(triumph);
    expect(awaiting.label).toBe('Shared Triumph');
    expect(g.state.cards[triumph]?.chosenType).toBeNull();
    // Nothing is pumped while the question stands.
    expect(power(g, bears)).toBe(2);
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bear' }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[triumph]?.chosenType).toBe('Bear');
    expect(power(g, bears)).toBe(3);
    expect(power(g, cyclops)).toBe(5);
  });

  test('a name outside the catalogue and another player are refused; the prompt stands', () => {
    const { g, triumph } = armed();
    const bad = g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bearz' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('notACreatureType');
    const theirs = g.submit({ t: 'AnswerChooseCreatureType', player: 'p2', creatureType: 'Bear' });
    expect(theirs.ok).toBe(false);
    if (!theirs.ok) expect(theirs.reason).toBe('notYourTurn');
    expect(g.state.priority.awaiting?.kind).toBe('chooseCreatureType');
    expect(g.state.cards[triumph]?.chosenType).toBeNull();
    // With nothing waiting, the answer is refused too.
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Cyclops' }));
    const stale = g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bear' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toBe('noPendingChoice');
    expect(g.state.cards[triumph]?.chosenType).toBe('Cyclops');
  });

  test('a permanent that leaves and returns is a new object: cleared, and asked again', () => {
    const { g, triumph, bears } = armed();
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bear' }));
    settle(g);
    expect(power(g, bears)).toBe(3);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: triumph, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[triumph]?.chosenType).toBeNull();
    expect(power(g, bears)).toBe(2);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: triumph, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseCreatureType');
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Cyclops' }));
    settle(g);
    expect(g.state.cards[triumph]?.chosenType).toBe('Cyclops');
    expect(power(g, bears)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bear' }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
