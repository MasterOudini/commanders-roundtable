// `Carnage Altar` — "{3}, Sacrifice a creature: Draw a card." The FIRST def
// behind the sacrifice-cost CHOOSER (D168): the activation names which
// creature pays (`ActivateAbility.sacrifice`), `legal.ts` offers the ability
// only while a legal candidate exists, and the charge is paid at activation in
// the cost batch. The def owes only the draw. M6.4k, D168.

import { CARNAGE_ALTAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CARNAGE_ALTAR, '{3}, Sacrifice a creature: Draw a card.');

export const CARNAGE_ALTAR_SCRIPT: CardScript = {
  oracleId: CARNAGE_ALTAR.oracleId,
  name: CARNAGE_ALTAR.name,
  activated: [
    {
      ref: `${CARNAGE_ALTAR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
