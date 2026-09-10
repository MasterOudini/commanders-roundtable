// `Gideon's Avenger` - a becomesTapped trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIDEON_S_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIDEON_S_AVENGER, "Whenever a creature an opponent controls becomes tapped, put a +1/+1 counter on this creature.");

export const GIDEONS_AVENGER_SCRIPT: CardScript = {
  oracleId: GIDEON_S_AVENGER.oracleId,
  name: GIDEON_S_AVENGER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'PermanentsTapped' && ev.cards.some((c) => ctx.state.cards[c]?.controller !== ctx.query.controllerOf(self) && ctx.derive(c).typeLine.types.includes('Creature')),
      label: () => "Gideon's Avenger - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
