// `Boros Mastiff` - a battalion trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOROS_MASTIFF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOROS_MASTIFF, "Battalion — Whenever this creature and at least two other creatures attack, this creature gains lifelink until end of turn. (Damage dealt by a creature with lifelink also causes its controller to gain that much life.)");

export const BOROS_MASTIFF_SCRIPT: CardScript = {
  oracleId: BOROS_MASTIFF.oracleId,
  name: BOROS_MASTIFF.name,
  triggers: [
    {
      abilityId: 'battalion-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Boros Mastiff - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["lifelink"] }];
      },
    },
  ],
};
