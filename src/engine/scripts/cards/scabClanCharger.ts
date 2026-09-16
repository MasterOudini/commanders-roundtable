// `Scab-Clan Charger` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCAB_CLAN_CHARGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCAB_CLAN_CHARGER, "Bloodrush — {1}{G}, Discard this card: Target attacking creature gets +2/+4 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +2/+4 until end of turn.", SCAB_CLAN_CHARGER.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +2/+4 until end of turn.");

export const SCAB_CLAN_CHARGER_SCRIPT: CardScript = {
  oracleId: SCAB_CLAN_CHARGER.oracleId,
  name: SCAB_CLAN_CHARGER.name,
  activated: [
    {
      ref: `${SCAB_CLAN_CHARGER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
