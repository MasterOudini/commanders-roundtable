// `Scale of Chiss-Goria` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCALE_OF_CHISS_GORIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCALE_OF_CHISS_GORIA, "Flash\nAffinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\n{T}: Target creature gets +0/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const SCALE_OF_CHISS_GORIA_SCRIPT: CardScript = {
  oracleId: SCALE_OF_CHISS_GORIA.oracleId,
  name: SCALE_OF_CHISS_GORIA.name,
  activated: [
    {
      ref: `${SCALE_OF_CHISS_GORIA.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 1 }];
      },
    },
  ],
};
