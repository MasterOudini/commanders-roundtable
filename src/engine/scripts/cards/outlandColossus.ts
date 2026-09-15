// `Outland Colossus` - a renownDamage trigger renown, a static maxBlockers
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OUTLAND_COLOSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OUTLAND_COLOSSUS, "Renown 6 (When this creature deals combat damage to a player, if it isn't renowned, put six +1/+1 counters on it and it becomes renowned.)\nThis creature can't be blocked by more than one creature.");
const LINES = PRINTED.split('\n');

export const OUTLAND_COLOSSUS_SCRIPT: CardScript = {
  oracleId: OUTLAND_COLOSSUS.oracleId,
  name: OUTLAND_COLOSSUS.name,
  triggers: [
    {
      abilityId: 'renownDamage-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && !(ctx.state.cards[self]?.renowned ?? false) && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Outland Colossus - renown",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Renown 6 (CR 702.112): checked again on resolution - once renowned, never again.
        if (ctx.state.cards[self]?.renowned) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 6 }] }, { t: 'BecameRenowned', card: self }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'maxBlockers-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      maxBlockers: (_ctx, self, attacker) => (attacker === self ? 1 : null),
    },
  ],
};
