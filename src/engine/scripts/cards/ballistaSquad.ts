// `Ballista Squad` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALLISTA_SQUAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALLISTA_SQUAD, "{X}{W}, {T}: This creature deals X damage to target attacking or blocking creature.");

const VOCAB_A0 = vocabularyEffects("~ deals X damage to target attacking or blocking creature.", BALLISTA_SQUAD.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to target attacking or blocking creature.");

export const BALLISTA_SQUAD_SCRIPT: CardScript = {
  oracleId: BALLISTA_SQUAD.oracleId,
  name: BALLISTA_SQUAD.name,
  activated: [
    {
      ref: `${BALLISTA_SQUAD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
