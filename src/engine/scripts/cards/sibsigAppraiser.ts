// `Sibsig Appraiser` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIBSIG_APPRAISER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIBSIG_APPRAISER, "When this creature enters, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");

const VOCAB_L0 = vocabularyEffects("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.", SIBSIG_APPRAISER.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");

export const SIBSIG_APPRAISER_SCRIPT: CardScript = {
  oracleId: SIBSIG_APPRAISER.oracleId,
  name: SIBSIG_APPRAISER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sibsig Appraiser - Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
