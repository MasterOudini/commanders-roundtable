// `Bramble Creeper` - a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAMBLE_CREEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRAMBLE_CREEPER, "Whenever this creature attacks, it gets +5/+0 until end of turn.");

export const BRAMBLE_CREEPER_SCRIPT: CardScript = {
  oracleId: BRAMBLE_CREEPER.oracleId,
  name: BRAMBLE_CREEPER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Bramble Creeper - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 5, toughness: 0 }];
      },
    },
  ],
};
