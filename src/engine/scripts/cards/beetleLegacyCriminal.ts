// `Beetle, Legacy Criminal` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEETLE_LEGACY_CRIMINAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEETLE_LEGACY_CRIMINAL, "Flying\n{1}{U}, Exile this card from your graveyard: Put a +1/+1 counter on target creature. It gains flying until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on target creature. It gains flying until end of turn.", BEETLE_LEGACY_CRIMINAL.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on target creature. It gains flying until end of turn.");

export const BEETLE_LEGACY_CRIMINAL_SCRIPT: CardScript = {
  oracleId: BEETLE_LEGACY_CRIMINAL.oracleId,
  name: BEETLE_LEGACY_CRIMINAL.name,
  activated: [
    {
      ref: `${BEETLE_LEGACY_CRIMINAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
