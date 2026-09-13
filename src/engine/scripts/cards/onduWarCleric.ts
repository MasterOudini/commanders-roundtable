// `Ondu War Cleric` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ONDU_WAR_CLERIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ONDU_WAR_CLERIC, "Cohort — {T}, Tap an untapped Ally you control: You gain 2 life.");

export const ONDU_WAR_CLERIC_SCRIPT: CardScript = {
  oracleId: ONDU_WAR_CLERIC.oracleId,
  name: ONDU_WAR_CLERIC.name,
  activated: [
    {
      ref: `${ONDU_WAR_CLERIC.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
