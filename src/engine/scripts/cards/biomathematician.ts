// `Biomathematician` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BIOMATHEMATICIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BIOMATHEMATICIAN, "When this creature enters, create a 0/0 green and blue Fractal creature token. Put a +1/+1 counter on each Fractal you control.");

const VOCAB_L0 = vocabularyEffects("Create a 0/0 green and blue Fractal creature token. Put a +1/+1 counter on each Fractal you control.", BIOMATHEMATICIAN.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 0/0 green and blue Fractal creature token. Put a +1/+1 counter on each Fractal you control.");

export const BIOMATHEMATICIAN_SCRIPT: CardScript = {
  oracleId: BIOMATHEMATICIAN.oracleId,
  name: BIOMATHEMATICIAN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Biomathematician - Create a 0/0 green and blue Fractal creature token. Put a +1/+1 counter on each Fractal you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
