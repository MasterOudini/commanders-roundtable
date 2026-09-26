// `Person of Interest` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PERSON_OF_INTEREST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PERSON_OF_INTEREST, "When this creature enters, suspect it. Create a 2/2 white and blue Detective creature token. (A suspected creature has menace and can't block.)");

const VOCAB_L0 = vocabularyEffects("Suspect ~. Create a 2/2 white and blue Detective creature token.", PERSON_OF_INTEREST.name);
const VOCAB_T_L0 = vocabularyTargets("Suspect ~. Create a 2/2 white and blue Detective creature token.");

export const PERSON_OF_INTEREST_SCRIPT: CardScript = {
  oracleId: PERSON_OF_INTEREST.oracleId,
  name: PERSON_OF_INTEREST.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Person of Interest - Suspect ~. Create a 2/2 white and blue Detective creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
