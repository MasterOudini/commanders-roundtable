// `Claws of Gix` — "{1}, Sacrifice a permanent: You gain 1 life." The chooser
// cost's WIDEST predicate (D168): "a permanent" is the empty predicate, so
// every permanent its controller has is a candidate — INCLUDING the Claws
// itself, which is the self-INCLUSION mirror of Ahriman's "another". The
// ability resolves from the stack whether or not its source survived paying
// (CR 113.7a), so the resolve reads nothing off the source. M6.4k, D168.

import { CLAWS_OF_GIX } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CLAWS_OF_GIX, '{1}, Sacrifice a permanent: You gain 1 life.');

export const CLAWS_OF_GIX_SCRIPT: CardScript = {
  oracleId: CLAWS_OF_GIX.oracleId,
  name: CLAWS_OF_GIX.name,
  activated: [
    {
      ref: `${CLAWS_OF_GIX.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
