// `Bishop of the Bloodstained` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BISHOP_OF_THE_BLOODSTAINED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BISHOP_OF_THE_BLOODSTAINED, "When this creature enters, target opponent loses 1 life for each Vampire you control.");

const VOCAB_L0 = vocabularyEffects("Target opponent loses 1 life for each Vampire you control.", BISHOP_OF_THE_BLOODSTAINED.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses 1 life for each Vampire you control.");

export const BISHOP_OF_THE_BLOODSTAINED_SCRIPT: CardScript = {
  oracleId: BISHOP_OF_THE_BLOODSTAINED.oracleId,
  name: BISHOP_OF_THE_BLOODSTAINED.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Bishop of the Bloodstained - Target opponent loses 1 life for each Vampire you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
