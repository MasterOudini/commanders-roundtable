// `Yavimaya Steelcrusher` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAVIMAYA_STEELCRUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAVIMAYA_STEELCRUSHER, "Enlist (As this creature attacks, you may tap a nonattacking creature you control without summoning sickness. When you do, add its power to this creature's until end of turn.)\n{1}, Sacrifice this creature: Destroy target artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact.", YAVIMAYA_STEELCRUSHER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact.");

export const YAVIMAYA_STEELCRUSHER_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_STEELCRUSHER.oracleId,
  name: YAVIMAYA_STEELCRUSHER.name,
  activated: [
    {
      ref: `${YAVIMAYA_STEELCRUSHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
