// `Plague Witch` — black mana, the tap and a discarded card of my choice
// (D286) give a creature -1/-1 until cleanup.

import { PLAGUE_WITCH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PLAGUE_WITCH, '{B}, {T}, Discard a card: Target creature gets -1/-1 until end of turn.');

export const PLAGUE_WITCH_SCRIPT: CardScript = {
  oracleId: PLAGUE_WITCH.oracleId,
  name: PLAGUE_WITCH.name,
  activated: [
    {
      ref: `${PLAGUE_WITCH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1, keywords: [] }];
      },
    },
  ],
};
