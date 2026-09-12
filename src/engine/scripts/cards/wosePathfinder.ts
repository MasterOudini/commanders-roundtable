// `Wose Pathfinder` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOSE_PATHFINDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WOSE_PATHFINDER, "{T}: Add one mana of any color.\n{6}{G}, {T}: Another target creature gets +3/+3 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Another target creature gets +3/+3 and gains trample until end of turn.", WOSE_PATHFINDER.name);
const VOCAB_T_A1 = vocabularyTargets("Another target creature gets +3/+3 and gains trample until end of turn.");

export const WOSE_PATHFINDER_SCRIPT: CardScript = {
  oracleId: WOSE_PATHFINDER.oracleId,
  name: WOSE_PATHFINDER.name,
  activated: [
    {
      ref: `${WOSE_PATHFINDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
