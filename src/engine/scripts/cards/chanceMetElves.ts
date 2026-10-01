// `Chance-Met Elves` - a youScry trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHANCE_MET_ELVES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHANCE_MET_ELVES, "Whenever you scry, put a +1/+1 counter on this creature. This ability triggers only once each turn.");

export const CHANCE_MET_ELVES_SCRIPT: CardScript = {
  oracleId: CHANCE_MET_ELVES.oracleId,
  name: CHANCE_MET_ELVES.name,
  triggers: [
    {
      abilityId: 'youScry-0',
      text: PRINTED,
      event: 'Scried',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'Scried' && ev.player === ctx.query.controllerOf(self),
      label: () => "Chance-Met Elves - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
