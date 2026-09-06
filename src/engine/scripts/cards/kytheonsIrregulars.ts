// `Kytheon's Irregulars` - a renownDamage trigger renown, an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KYTHEON_S_IRREGULARS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KYTHEON_S_IRREGULARS, "Renown 1 (When this creature deals combat damage to a player, if it isn't renowned, put a +1/+1 counter on it and it becomes renowned.)\n{W}{W}: Tap target creature.");
const LINES = PRINTED.split('\n');

export const KYTHEONS_IRREGULARS_SCRIPT: CardScript = {
  oracleId: KYTHEON_S_IRREGULARS.oracleId,
  name: KYTHEON_S_IRREGULARS.name,
  activated: [
    {
      ref: `${KYTHEON_S_IRREGULARS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'renownDamage-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && !(ctx.state.cards[self]?.renowned ?? false) && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Kytheon's Irregulars - renown",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Renown 1 (CR 702.112): checked again on resolution - once renowned, never again.
        if (ctx.state.cards[self]?.renowned) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }, { t: 'BecameRenowned', card: self }];
      },
    },
  ],
};
