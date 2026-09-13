// `Mask of Riddles` - a static attachedStatic, a equippedCreatureCombatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MASK_OF_RIDDLES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MASK_OF_RIDDLES, "Equipped creature has fear. (It can't be blocked except by artifact creatures and/or black creatures.)\nWhenever equipped creature deals combat damage to a player, you may draw a card.\nEquip {2}");
const LINES = PRINTED.split('\n');

export const MASK_OF_RIDDLES_SCRIPT: CardScript = {
  oracleId: MASK_OF_RIDDLES.oracleId,
  name: MASK_OF_RIDDLES.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Mask of Riddles - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
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
        chars.keywords.add("fear");
      },
    },
  ],
};
