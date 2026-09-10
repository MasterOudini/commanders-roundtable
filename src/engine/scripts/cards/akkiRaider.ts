// `Akki Raider` - a cardPutIntoGraveyard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKKI_RAIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKKI_RAIDER, "Whenever a land is put into a graveyard from the battlefield, this creature gets +1/+0 until end of turn.");

export const AKKI_RAIDER_SCRIPT: CardScript = {
  oracleId: AKKI_RAIDER.oracleId,
  name: AKKI_RAIDER.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Akki Raider - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
