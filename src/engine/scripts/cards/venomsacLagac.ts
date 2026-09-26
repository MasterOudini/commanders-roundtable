// `Venomsac Lagac` - a attacksWhileSaddled trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENOMSAC_LAGAC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENOMSAC_LAGAC, "Deathtouch\nWhenever this creature attacks while saddled, it gets +0/+3 until end of turn.\nSaddle 2 (Tap any number of other creatures you control with total power 2 or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const VENOMSAC_LAGAC_SCRIPT: CardScript = {
  oracleId: VENOMSAC_LAGAC.oracleId,
  name: VENOMSAC_LAGAC.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Venomsac Lagac - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 3 }];
      },
    },
  ],
};
