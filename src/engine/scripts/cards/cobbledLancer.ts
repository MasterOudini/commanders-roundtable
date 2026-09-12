// `Cobbled Lancer` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COBBLED_LANCER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(COBBLED_LANCER, "As an additional cost to cast this spell, exile a creature card from your graveyard.\n{3}{U}, Exile this card from your graveyard: Draw a card.");
const LINES = PRINTED.split('\n');

export const COBBLED_LANCER_SCRIPT: CardScript = {
  oracleId: COBBLED_LANCER.oracleId,
  name: COBBLED_LANCER.name,
  activated: [
    {
      ref: `${COBBLED_LANCER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
