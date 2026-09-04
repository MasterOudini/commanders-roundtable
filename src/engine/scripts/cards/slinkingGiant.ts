// `Slinking Giant` - a blocksOrBecomesBlocked trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLINKING_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLINKING_GIANT, "Wither (This deals damage to creatures in the form of -1/-1 counters.)\nWhenever this creature blocks or becomes blocked, it gets -3/-0 until end of turn.");
const LINES = PRINTED.split('\n');

export const SLINKING_GIANT_SCRIPT: CardScript = {
  oracleId: SLINKING_GIANT.oracleId,
  name: SLINKING_GIANT.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Slinking Giant - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: -3, toughness: 0 }];
      },
    },
  ],
};
