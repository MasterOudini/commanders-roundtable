// `Mogg Raider` — Goblin Sledder's exact printed text on a second oracle
// id: the Goblin chooser paying for the pump, itself a legal price
// (CR 113.7a). D226.

import { MOGG_RAIDER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MOGG_RAIDER, 'Sacrifice a Goblin: Target creature gets +1/+1 until end of turn.');

export const MOGG_RAIDER_SCRIPT: CardScript = {
  oracleId: MOGG_RAIDER.oracleId,
  name: MOGG_RAIDER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${MOGG_RAIDER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
