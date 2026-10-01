// `Flamespeaker Adept` - a youScry trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAMESPEAKER_ADEPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAMESPEAKER_ADEPT, "Whenever you scry, this creature gets +2/+0 and gains first strike until end of turn.");

export const FLAMESPEAKER_ADEPT_SCRIPT: CardScript = {
  oracleId: FLAMESPEAKER_ADEPT.oracleId,
  name: FLAMESPEAKER_ADEPT.name,
  triggers: [
    {
      abilityId: 'youScry-0',
      text: PRINTED,
      event: 'Scried',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'Scried' && ev.player === ctx.query.controllerOf(self),
      label: () => "Flamespeaker Adept - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
