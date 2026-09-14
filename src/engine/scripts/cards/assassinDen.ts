// `Assassin Den` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASSASSIN_DEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASSASSIN_DEN, "Defender (This creature can't attack.)\n{3}{U}: Put a +1/+1 counter on target creature you control. It can't be blocked this turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on target creature you control. It can't be blocked this turn.", ASSASSIN_DEN.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on target creature you control. It can't be blocked this turn.");

export const ASSASSIN_DEN_SCRIPT: CardScript = {
  oracleId: ASSASSIN_DEN.oracleId,
  name: ASSASSIN_DEN.name,
  activated: [
    {
      ref: `${ASSASSIN_DEN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
