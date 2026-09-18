// `Mushroom Watchdogs` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MUSHROOM_WATCHDOGS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MUSHROOM_WATCHDOGS, "Sacrifice a Food: Put a +1/+1 counter on this creature. It gains vigilance until end of turn. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains vigilance until end of turn.", MUSHROOM_WATCHDOGS.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains vigilance until end of turn.");

export const MUSHROOM_WATCHDOGS_SCRIPT: CardScript = {
  oracleId: MUSHROOM_WATCHDOGS.oracleId,
  name: MUSHROOM_WATCHDOGS.name,
  activated: [
    {
      ref: `${MUSHROOM_WATCHDOGS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
