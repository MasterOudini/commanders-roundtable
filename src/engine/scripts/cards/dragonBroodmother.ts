// `Dragon Broodmother` - a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGON_BROODMOTHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAGON_BROODMOTHER, "Flying\nAt the beginning of each upkeep, create a 1/1 red and green Dragon creature token with flying and devour 2. (As the token enters, you may sacrifice any number of creatures. It enters with twice that many +1/+1 counters on it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 1/1 red and green Dragon creature token with flying and devour 2.", DRAGON_BROODMOTHER.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 red and green Dragon creature token with flying and devour 2.");

export const DRAGON_BROODMOTHER_SCRIPT: CardScript = {
  oracleId: DRAGON_BROODMOTHER.oracleId,
  name: DRAGON_BROODMOTHER.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Dragon Broodmother - Create a 1/1 red and green Dragon creature token with flying and devour 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
