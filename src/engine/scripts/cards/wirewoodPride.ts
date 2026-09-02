// `Wirewood Pride` — +X/+X where X is the number of ELVES ON THE BATTLEFIELD.
//
// ⚠️ The card names NO controller, so the opponent's Elves count too — the
// same reading D265's Valorous Charge needed. Counted at resolution, off the
// derived subtypes. D270.

import { WIREWOOD_PRIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  WIREWOOD_PRIDE,
  'Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield.',
);

export const WIREWOOD_PRIDE_SCRIPT: CardScript = {
  oracleId: WIREWOOD_PRIDE.oracleId,
  name: WIREWOOD_PRIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];

      let elves = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Elf')) elves += 1;
      }
      if (elves === 0) return [];

      return [
        {
          t: 'PtModifiedUntilEndOfTurn',
          card: target.id,
          power: elves,
          toughness: elves,
          keywords: [],
        },
      ];
    },
  },
};
