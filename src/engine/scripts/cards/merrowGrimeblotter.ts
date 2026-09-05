// `Merrow Grimeblotter` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERROW_GRIMEBLOTTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERROW_GRIMEBLOTTER, "{1}{U/B}, {Q}: Target creature gets -2/-0 until end of turn. ({Q} is the untap symbol.)");

export const MERROW_GRIMEBLOTTER_SCRIPT: CardScript = {
  oracleId: MERROW_GRIMEBLOTTER.oracleId,
  name: MERROW_GRIMEBLOTTER.name,
  activated: [
    {
      ref: `${MERROW_GRIMEBLOTTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
