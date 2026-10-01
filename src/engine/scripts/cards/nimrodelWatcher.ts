// `Nimrodel Watcher` - a youScry trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIMRODEL_WATCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIMRODEL_WATCHER, "Whenever you scry, this creature gets +1/+0 until end of turn and can't be blocked this turn. This ability triggers only once each turn.");

export const NIMRODEL_WATCHER_SCRIPT: CardScript = {
  oracleId: NIMRODEL_WATCHER.oracleId,
  name: NIMRODEL_WATCHER.name,
  triggers: [
    {
      abilityId: 'youScry-0',
      text: PRINTED,
      event: 'Scried',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'Scried' && ev.player === ctx.query.controllerOf(self),
      label: () => "Nimrodel Watcher - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, cantBeBlocked: true }];
      },
    },
  ],
};
