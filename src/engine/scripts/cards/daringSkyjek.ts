// `Daring Skyjek` - a battalion trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARING_SKYJEK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARING_SKYJEK, "Battalion — Whenever this creature and at least two other creatures attack, this creature gains flying until end of turn.");

export const DARING_SKYJEK_SCRIPT: CardScript = {
  oracleId: DARING_SKYJEK.oracleId,
  name: DARING_SKYJEK.name,
  triggers: [
    {
      abilityId: 'battalion-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Daring Skyjek - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
