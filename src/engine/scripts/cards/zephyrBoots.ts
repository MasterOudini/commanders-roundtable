// `Zephyr Boots` - a static attachedStatic, a equippedCreatureCombatDamagePlayer trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZEPHYR_BOOTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZEPHYR_BOOTS, "Equipped creature has flying.\nWhenever equipped creature deals combat damage to a player, draw a card, then discard a card.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const ZEPHYR_BOOTS_SCRIPT: CardScript = {
  oracleId: ZEPHYR_BOOTS.oracleId,
  name: ZEPHYR_BOOTS.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Zephyr Boots - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Zephyr Boots - discard a card" } },
        ];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
