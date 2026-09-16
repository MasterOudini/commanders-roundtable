// `Rejuvenation Chamber` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REJUVENATION_CHAMBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REJUVENATION_CHAMBER, "Fading 2 (This artifact enters with two fade counters on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.)\n{T}: You gain 2 life.");
const LINES = PRINTED.split('\n');

export const REJUVENATION_CHAMBER_SCRIPT: CardScript = {
  oracleId: REJUVENATION_CHAMBER.oracleId,
  name: REJUVENATION_CHAMBER.name,
  activated: [
    {
      ref: `${REJUVENATION_CHAMBER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
