// `Serra Inquisitors` - a blocksOrBecomesBlockedBy trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERRA_INQUISITORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERRA_INQUISITORS, "Whenever this creature blocks or becomes blocked by one or more black creatures, this creature gets +2/+0 until end of turn.");

export const SERRA_INQUISITORS_SCRIPT: CardScript = {
  oracleId: SERRA_INQUISITORS.oracleId,
  name: SERRA_INQUISITORS.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlockedBy-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => (b.blocker === self && ctx.derive(b.attacker).colors.some((c) => ["B"].includes(c))) || (b.attacker === self && ctx.derive(b.blocker).colors.some((c) => ["B"].includes(c)))),
      label: () => "Serra Inquisitors - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
