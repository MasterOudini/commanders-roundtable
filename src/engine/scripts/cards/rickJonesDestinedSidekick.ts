// `Rick Jones, Destined Sidekick` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RICK_JONES_DESTINED_SIDEKICK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RICK_JONES_DESTINED_SIDEKICK, "{3}, {T}: Mill four cards. You may put a Hero or enchantment card from among those cards into your hand. (To mill four cards, put the top four cards of your library into your graveyard.)");

const VOCAB_A0 = vocabularyEffects("Mill four cards. You may put a Hero or enchantment card from among those cards into your hand.", RICK_JONES_DESTINED_SIDEKICK.name);
const VOCAB_T_A0 = vocabularyTargets("Mill four cards. You may put a Hero or enchantment card from among those cards into your hand.");

export const RICK_JONES_DESTINED_SIDEKICK_SCRIPT: CardScript = {
  oracleId: RICK_JONES_DESTINED_SIDEKICK.oracleId,
  name: RICK_JONES_DESTINED_SIDEKICK.name,
  activated: [
    {
      ref: `${RICK_JONES_DESTINED_SIDEKICK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
