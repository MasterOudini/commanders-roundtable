// `Roon of the Hidden Realm` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROON_OF_THE_HIDDEN_REALM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROON_OF_THE_HIDDEN_REALM, "Vigilance, trample\n{2}, {T}: Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.", ROON_OF_THE_HIDDEN_REALM.name);
const VOCAB_T_A0 = vocabularyTargets("Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const ROON_OF_THE_HIDDEN_REALM_SCRIPT: CardScript = {
  oracleId: ROON_OF_THE_HIDDEN_REALM.oracleId,
  name: ROON_OF_THE_HIDDEN_REALM.name,
  activated: [
    {
      ref: `${ROON_OF_THE_HIDDEN_REALM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
