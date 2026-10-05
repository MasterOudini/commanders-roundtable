// `Marchesa, Dealer of Death` - a youCommitCrime trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARCHESA_DEALER_OF_DEATH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARCHESA_DEALER_OF_DEATH, "Whenever you commit a crime, you may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.", MARCHESA_DEALER_OF_DEATH.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");

export const MARCHESA_DEALER_OF_DEATH_SCRIPT: CardScript = {
  oracleId: MARCHESA_DEALER_OF_DEATH.oracleId,
  name: MARCHESA_DEALER_OF_DEATH.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-0',
      text: PRINTED,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Marchesa, Dealer of Death - You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
