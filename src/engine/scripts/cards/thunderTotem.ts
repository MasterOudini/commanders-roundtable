// `Thunder Totem` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THUNDER_TOTEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THUNDER_TOTEM, "{T}: Add {W}.\n{1}{W}{W}: This artifact becomes a 2/2 white Spirit artifact creature with flying and first strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/2 white Spirit artifact creature with flying and first strike until end of turn.", THUNDER_TOTEM.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/2 white Spirit artifact creature with flying and first strike until end of turn.");

export const THUNDER_TOTEM_SCRIPT: CardScript = {
  oracleId: THUNDER_TOTEM.oracleId,
  name: THUNDER_TOTEM.name,
  activated: [
    {
      ref: `${THUNDER_TOTEM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
