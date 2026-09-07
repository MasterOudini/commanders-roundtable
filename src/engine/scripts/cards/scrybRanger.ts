// `Scryb Ranger` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCRYB_RANGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCRYB_RANGER, "Flash\nFlying, protection from blue\nReturn a Forest you control to its owner's hand: Untap target creature. Activate only once each turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap target creature.", SCRYB_RANGER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target creature.");

export const SCRYB_RANGER_SCRIPT: CardScript = {
  oracleId: SCRYB_RANGER.oracleId,
  name: SCRYB_RANGER.name,
  activated: [
    {
      ref: `${SCRYB_RANGER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
