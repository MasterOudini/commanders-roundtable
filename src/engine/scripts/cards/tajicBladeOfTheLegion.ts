// `Tajic, Blade of the Legion` - a battalion trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAJIC_BLADE_OF_THE_LEGION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAJIC_BLADE_OF_THE_LEGION, "Indestructible\nBattalion — Whenever Tajic and at least two other creatures attack, Tajic gets +5/+5 until end of turn.");
const LINES = PRINTED.split('\n');

export const TAJIC_BLADE_OF_THE_LEGION_SCRIPT: CardScript = {
  oracleId: TAJIC_BLADE_OF_THE_LEGION.oracleId,
  name: TAJIC_BLADE_OF_THE_LEGION.name,
  triggers: [
    {
      abilityId: 'battalion-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Tajic, Blade of the Legion - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 5, toughness: 5 }];
      },
    },
  ],
};
