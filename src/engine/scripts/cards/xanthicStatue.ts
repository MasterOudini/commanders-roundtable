// `Xanthic Statue` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { XANTHIC_STATUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(XANTHIC_STATUE, "{5}: Until end of turn, this artifact becomes an 8/8 Golem artifact creature with trample.");

const VOCAB_A0 = vocabularyEffects("Until end of turn, this artifact becomes an 8/8 Golem artifact creature with trample.", XANTHIC_STATUE.name);
const VOCAB_T_A0 = vocabularyTargets("Until end of turn, this artifact becomes an 8/8 Golem artifact creature with trample.");

export const XANTHIC_STATUE_SCRIPT: CardScript = {
  oracleId: XANTHIC_STATUE.oracleId,
  name: XANTHIC_STATUE.name,
  activated: [
    {
      ref: `${XANTHIC_STATUE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
