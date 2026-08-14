// `Goblin Sledder` — "Sacrifice a Goblin: Target creature gets +1/+1 until
// end of turn." The D168 SUBTYPE chooser (Arms Dealer's Goblin predicate)
// with NO mana, paired with a pump through D169's staged chain. The Sledder
// is itself a Goblin and may pay with itself (CR 113.7a). M6.4u, D177.

import { GOBLIN_SLEDDER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GOBLIN_SLEDDER, 'Sacrifice a Goblin: Target creature gets +1/+1 until end of turn.');

export const GOBLIN_SLEDDER_SCRIPT: CardScript = {
  oracleId: GOBLIN_SLEDDER.oracleId,
  name: GOBLIN_SLEDDER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GOBLIN_SLEDDER.oracleId}#a0`,
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
