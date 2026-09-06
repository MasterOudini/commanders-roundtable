// `Pharika's Disciple` - a renownDamage trigger renown
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHARIKA_S_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHARIKA_S_DISCIPLE, "Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\nRenown 1 (When this creature deals combat damage to a player, if it isn't renowned, put a +1/+1 counter on it and it becomes renowned.)");
const LINES = PRINTED.split('\n');

export const PHARIKAS_DISCIPLE_SCRIPT: CardScript = {
  oracleId: PHARIKA_S_DISCIPLE.oracleId,
  name: PHARIKA_S_DISCIPLE.name,
  triggers: [
    {
      abilityId: 'renownDamage-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && !(ctx.state.cards[self]?.renowned ?? false) && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Pharika's Disciple - renown",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Renown 1 (CR 702.112): checked again on resolution - once renowned, never again.
        if (ctx.state.cards[self]?.renowned) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }, { t: 'BecameRenowned', card: self }];
      },
    },
  ],
};
