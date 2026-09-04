// `Escaped Null` - a blocksOrBecomesBlocked trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ESCAPED_NULL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ESCAPED_NULL, "Lifelink\nWhenever this creature blocks or becomes blocked, it gets +5/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const ESCAPED_NULL_SCRIPT: CardScript = {
  oracleId: ESCAPED_NULL.oracleId,
  name: ESCAPED_NULL.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Escaped Null - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 5, toughness: 0 }];
      },
    },
  ],
};
