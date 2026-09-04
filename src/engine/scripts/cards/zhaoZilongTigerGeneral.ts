// `Zhao Zilong, Tiger General` - a blocks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZHAO_ZILONG_TIGER_GENERAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZHAO_ZILONG_TIGER_GENERAL, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nWhenever Zhao Zilong blocks, it gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const ZHAO_ZILONG_TIGER_GENERAL_SCRIPT: CardScript = {
  oracleId: ZHAO_ZILONG_TIGER_GENERAL.oracleId,
  name: ZHAO_ZILONG_TIGER_GENERAL.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Zhao Zilong, Tiger General - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
