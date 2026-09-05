// `Rogue Kavu` - a attacksAlone trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROGUE_KAVU } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROGUE_KAVU, "Whenever this creature attacks alone, it gets +2/+0 until end of turn.");

export const ROGUE_KAVU_SCRIPT: CardScript = {
  oracleId: ROGUE_KAVU.oracleId,
  name: ROGUE_KAVU.name,
  triggers: [
    {
      abilityId: 'attacksAlone-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers[0]?.card === self,
      label: () => "Rogue Kavu - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
