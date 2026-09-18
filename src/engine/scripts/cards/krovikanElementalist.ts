// `Krovikan Elementalist` - an activation pumpTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROVIKAN_ELEMENTALIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROVIKAN_ELEMENTALIST, "{2}{R}: Target creature gets +1/+0 until end of turn.\n{U}{U}: Target creature you control gains flying until end of turn. Sacrifice it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature you control gains flying until end of turn. Sacrifice it at the beginning of the next end step.", KROVIKAN_ELEMENTALIST.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature you control gains flying until end of turn. Sacrifice it at the beginning of the next end step.");

export const KROVIKAN_ELEMENTALIST_SCRIPT: CardScript = {
  oracleId: KROVIKAN_ELEMENTALIST.oracleId,
  name: KROVIKAN_ELEMENTALIST.name,
  activated: [
    {
      ref: `${KROVIKAN_ELEMENTALIST.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${KROVIKAN_ELEMENTALIST.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
