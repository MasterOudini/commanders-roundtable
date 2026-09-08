// `Korozda Gorgon` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOROZDA_GORGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOROZDA_GORGON, "Deathtouch\n{2}, Remove a +1/+1 counter from a creature you control: Target creature gets -1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

export const KOROZDA_GORGON_SCRIPT: CardScript = {
  oracleId: KOROZDA_GORGON.oracleId,
  name: KOROZDA_GORGON.name,
  activated: [
    {
      ref: `${KOROZDA_GORGON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
