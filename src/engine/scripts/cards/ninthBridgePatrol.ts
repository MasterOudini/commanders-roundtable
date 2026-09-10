// `Ninth Bridge Patrol` - a leavesBattlefield trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NINTH_BRIDGE_PATROL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NINTH_BRIDGE_PATROL, "Whenever another creature you control leaves the battlefield, put a +1/+1 counter on this creature.");

export const NINTH_BRIDGE_PATROL_SCRIPT: CardScript = {
  oracleId: NINTH_BRIDGE_PATROL.oracleId,
  name: NINTH_BRIDGE_PATROL.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind !== 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Ninth Bridge Patrol - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
