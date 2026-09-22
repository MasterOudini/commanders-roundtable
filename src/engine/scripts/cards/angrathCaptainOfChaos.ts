// `Angrath, Captain of Chaos` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANGRATH_CAPTAIN_OF_CHAOS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ANGRATH_CAPTAIN_OF_CHAOS, "Creatures you control have menace.\n−2: Amass Zombies 2. (Put two +1/+1 counters on an Army you control. It's also a Zombie. If you don't control an Army, create a 0/0 black Zombie Army creature token first.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Amass Zombies 2.", ANGRATH_CAPTAIN_OF_CHAOS.name);
const VOCAB_T_A0 = vocabularyTargets("Amass Zombies 2.");

export const ANGRATH_CAPTAIN_OF_CHAOS_SCRIPT: CardScript = {
  oracleId: ANGRATH_CAPTAIN_OF_CHAOS.oracleId,
  name: ANGRATH_CAPTAIN_OF_CHAOS.name,
  activated: [
    {
      ref: `${ANGRATH_CAPTAIN_OF_CHAOS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
