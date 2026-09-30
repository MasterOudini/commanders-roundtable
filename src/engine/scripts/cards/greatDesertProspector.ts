// `Great Desert Prospector` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GREAT_DESERT_PROSPECTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GREAT_DESERT_PROSPECTOR, "When this creature enters, create a tapped Powerstone token for each other creature you control. (They're artifacts with \"{T}: Add {C}. This mana can't be spent to cast a nonartifact spell.\")");

const VOCAB_L0 = vocabularyEffects("Create a tapped Powerstone token for each other creature you control.", GREAT_DESERT_PROSPECTOR.name);
const VOCAB_T_L0 = vocabularyTargets("Create a tapped Powerstone token for each other creature you control.");

export const GREAT_DESERT_PROSPECTOR_SCRIPT: CardScript = {
  oracleId: GREAT_DESERT_PROSPECTOR.oracleId,
  name: GREAT_DESERT_PROSPECTOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Great Desert Prospector - Create a tapped Powerstone token for each other creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
