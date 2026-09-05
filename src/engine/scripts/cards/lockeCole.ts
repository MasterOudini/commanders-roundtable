// `Locke Cole` - a combatDamagePlayer trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOCKE_COLE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(LOCKE_COLE, "Deathtouch, lifelink\nWhenever Locke Cole deals combat damage to a player, draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const LOCKE_COLE_SCRIPT: CardScript = {
  oracleId: LOCKE_COLE.oracleId,
  name: LOCKE_COLE.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Locke Cole - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Locke Cole - discard a card" } },
        ];
      },
    },
  ],
};
