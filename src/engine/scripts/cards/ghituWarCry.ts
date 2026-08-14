// `Ghitu War Cry` — "{R}: Target creature gets +1/+0 until end of turn."
// Captive Flame's EXACT printed text on a second oracle id (the Benalish
// Trapper precedent), from an enchantment. M6.4t, D176.

import { GHITU_WAR_CRY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GHITU_WAR_CRY, '{R}: Target creature gets +1/+0 until end of turn.');

export const GHITU_WAR_CRY_SCRIPT: CardScript = {
  oracleId: GHITU_WAR_CRY.oracleId,
  name: GHITU_WAR_CRY.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GHITU_WAR_CRY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 0 }];
      },
    },
  ],
};
