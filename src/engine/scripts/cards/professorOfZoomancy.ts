// `Professor of Zoomancy` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROFESSOR_OF_ZOOMANCY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROFESSOR_OF_ZOOMANCY, "When this creature enters, create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"");

const VOCAB_L0 = vocabularyEffects("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"", PROFESSOR_OF_ZOOMANCY.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"");

export const PROFESSOR_OF_ZOOMANCY_SCRIPT: CardScript = {
  oracleId: PROFESSOR_OF_ZOOMANCY.oracleId,
  name: PROFESSOR_OF_ZOOMANCY.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Professor of Zoomancy - Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
