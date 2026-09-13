// `Queza, Augur of Agonies` - a drawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUEZA_AUGUR_OF_AGONIES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUEZA_AUGUR_OF_AGONIES, "Whenever you draw a card, target opponent loses 1 life and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", QUEZA_AUGUR_OF_AGONIES.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const QUEZA_AUGUR_OF_AGONIES_SCRIPT: CardScript = {
  oracleId: QUEZA_AUGUR_OF_AGONIES.oracleId,
  name: QUEZA_AUGUR_OF_AGONIES.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Queza, Augur of Agonies - Target opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
