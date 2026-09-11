// `Kilo, Apogee Mind` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KILO_APOGEE_MIND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KILO_APOGEE_MIND, "Haste\nWhenever Kilo becomes tapped, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Proliferate.", KILO_APOGEE_MIND.name);
const VOCAB_T_L1 = vocabularyTargets("Proliferate.");

export const KILO_APOGEE_MIND_SCRIPT: CardScript = {
  oracleId: KILO_APOGEE_MIND.oracleId,
  name: KILO_APOGEE_MIND.name,
  triggers: [
    {
      abilityId: 'becomesTapped-1',
      text: LINES[1] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Kilo, Apogee Mind - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
