// `Phyrexia's Core` — "{1}, {T}, Sacrifice an artifact: You gain 1 life."
// The artifact chooser on a LAND, paying a gain (mana at #a0 is the
// engine's). D232.

import { PHYREXIA_S_CORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  PHYREXIA_S_CORE,
  '{T}: Add {C}.\n{1}, {T}, Sacrifice an artifact: You gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PHYREXIAS_CORE_SCRIPT: CardScript = {
  oracleId: PHYREXIA_S_CORE.oracleId,
  name: PHYREXIA_S_CORE.name,
  activated: [
    {
      ref: `${PHYREXIA_S_CORE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
