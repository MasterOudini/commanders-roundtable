// `Loporrit Scout` - a anotherCreatureEnters trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOPORRIT_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOPORRIT_SCOUT, "Whenever another creature you control enters, this creature gets +1/+1 until end of turn.");

export const LOPORRIT_SCOUT_SCRIPT: CardScript = {
  oracleId: LOPORRIT_SCOUT.oracleId,
  name: LOPORRIT_SCOUT.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Loporrit Scout - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
