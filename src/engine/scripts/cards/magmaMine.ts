// `Magma Mine` - an activation selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGMA_MINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGMA_MINE, "{4}: Put a pressure counter on this artifact.\n{T}, Sacrifice this artifact: It deals damage equal to the number of pressure counters on it to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ deals damage equal to the number of pressure counters on it to any target.", MAGMA_MINE.name);
const VOCAB_T_A1 = vocabularyTargets("~ deals damage equal to the number of pressure counters on it to any target.");

export const MAGMA_MINE_SCRIPT: CardScript = {
  oracleId: MAGMA_MINE.oracleId,
  name: MAGMA_MINE.name,
  activated: [
    {
      ref: `${MAGMA_MINE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "pressure", delta: 1 }] }];
      },
    },
    {
      ref: `${MAGMA_MINE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
