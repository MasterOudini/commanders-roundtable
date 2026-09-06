// `Dross Skullbomb` - an activation draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROSS_SKULLBOMB } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(DROSS_SKULLBOMB, "{1}, Sacrifice this artifact: Draw a card.\n{2}{B}, Sacrifice this artifact: Return target creature card from your graveyard to your hand. Draw a card. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Return target creature card from your graveyard to your hand. Draw a card.", DROSS_SKULLBOMB.name);
const VOCAB_T_A1 = vocabularyTargets("Return target creature card from your graveyard to your hand. Draw a card.");

export const DROSS_SKULLBOMB_SCRIPT: CardScript = {
  oracleId: DROSS_SKULLBOMB.oracleId,
  name: DROSS_SKULLBOMB.name,
  activated: [
    {
      ref: `${DROSS_SKULLBOMB.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${DROSS_SKULLBOMB.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
