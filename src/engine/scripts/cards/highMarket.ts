// `High Market` — "{T}: Add {C}.\n{T}, Sacrifice a creature: You gain 1
// life." Grim Backwoods' `#a1` with Carnage Altar's CREATURE predicate and a
// life payoff: the mana line is the engine's, the chooser rides the
// activation (D168), and the def owes line 1. M6.4w, D179.

import { HIGH_MARKET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIGH_MARKET, '{T}: Add {C}.\n{T}, Sacrifice a creature: You gain 1 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const HIGH_MARKET_SCRIPT: CardScript = {
  oracleId: HIGH_MARKET.oracleId,
  name: HIGH_MARKET.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the gain as ability 1.
      ref: `${HIGH_MARKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
