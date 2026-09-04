// `Root Spider` - a blocks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROOT_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROOT_SPIDER, "Whenever this creature blocks, it gets +1/+0 and gains first strike until end of turn.");

export const ROOT_SPIDER_SCRIPT: CardScript = {
  oracleId: ROOT_SPIDER.oracleId,
  name: ROOT_SPIDER.name,
  triggers: [
    {
      abilityId: 'blocks-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Root Spider - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
