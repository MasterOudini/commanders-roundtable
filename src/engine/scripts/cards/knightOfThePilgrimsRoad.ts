// `Knight of the Pilgrim's Road` - a renownDamage trigger renown
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_THE_PILGRIM_S_ROAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_THE_PILGRIM_S_ROAD, "Renown 1 (When this creature deals combat damage to a player, if it isn't renowned, put a +1/+1 counter on it and it becomes renowned.)");

export const KNIGHT_OF_THE_PILGRIMS_ROAD_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_THE_PILGRIM_S_ROAD.oracleId,
  name: KNIGHT_OF_THE_PILGRIM_S_ROAD.name,
  triggers: [
    {
      abilityId: 'renownDamage-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && !(ctx.state.cards[self]?.renowned ?? false) && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Knight of the Pilgrim's Road - renown",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Renown 1 (CR 702.112): checked again on resolution - once renowned, never again.
        if (ctx.state.cards[self]?.renowned) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }, { t: 'BecameRenowned', card: self }];
      },
    },
  ],
};
