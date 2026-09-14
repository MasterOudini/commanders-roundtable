// `Shrieking Drake` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHRIEKING_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHRIEKING_DRAKE, "Flying\nWhen this creature enters, return a creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return a creature you control to its owner's hand.", SHRIEKING_DRAKE.name);
const VOCAB_T_L1 = vocabularyTargets("Return a creature you control to its owner's hand.");

export const SHRIEKING_DRAKE_SCRIPT: CardScript = {
  oracleId: SHRIEKING_DRAKE.oracleId,
  name: SHRIEKING_DRAKE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Shrieking Drake - Return a creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
