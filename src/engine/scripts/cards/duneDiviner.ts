// `Dune Diviner` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUNE_DIVINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUNE_DIVINER, "{1}, Tap an untapped Desert you control: You gain 1 life.");

export const DUNE_DIVINER_SCRIPT: CardScript = {
  oracleId: DUNE_DIVINER.oracleId,
  name: DUNE_DIVINER.name,
  activated: [
    {
      ref: `${DUNE_DIVINER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
