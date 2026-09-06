// `Shu Farmer` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHU_FARMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHU_FARMER, "{T}: You gain 1 life. Activate only during your turn, before attackers are declared.");

export const SHU_FARMER_SCRIPT: CardScript = {
  oracleId: SHU_FARMER.oracleId,
  name: SHU_FARMER.name,
  activated: [
    {
      ref: `${SHU_FARMER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
