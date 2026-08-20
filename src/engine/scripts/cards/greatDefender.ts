// `Great Defender` — "+0/+X until end of turn, where X is its mana
// value." The X reads the target's own printing. D216.

import { GREAT_DEFENDER } from '../../../data/fixtures/engineCards';
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
  GREAT_DEFENDER,
  'Target creature gets +0/+X until end of turn, where X is its mana value.',
);

export const GREAT_DEFENDER_SCRIPT: CardScript = {
  oracleId: GREAT_DEFENDER.oracleId,
  name: GREAT_DEFENDER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const x = card.isToken ? 0 : (ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0);
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: x }];
    },
  },
};
