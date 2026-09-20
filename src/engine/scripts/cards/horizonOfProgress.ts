// `Horizon of Progress` - an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORIZON_OF_PROGRESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORIZON_OF_PROGRESS, "{T}, Pay 1 life: Add one mana of any type that a land you control could produce.\n{3}, {T}: You may put a land card from your hand onto the battlefield tapped.\n{1}, {T}, Sacrifice this land: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You may put a land card from your hand onto the battlefield tapped.", HORIZON_OF_PROGRESS.name);
const VOCAB_T_A1 = vocabularyTargets("You may put a land card from your hand onto the battlefield tapped.");

export const HORIZON_OF_PROGRESS_SCRIPT: CardScript = {
  oracleId: HORIZON_OF_PROGRESS.oracleId,
  name: HORIZON_OF_PROGRESS.name,
  activated: [
    {
      ref: `${HORIZON_OF_PROGRESS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${HORIZON_OF_PROGRESS.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
