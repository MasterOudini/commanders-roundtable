// `Sixth Sense` - a static attachedStatic, a combatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIXTH_SENSE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(SIXTH_SENSE, "Enchant creature\nEnchanted creature has \"Whenever this creature deals combat damage to a player, you may draw a card.\"");
const LINES = PRINTED.split('\n');

const GRANT_1 = grantedTriggerRef(`${SIXTH_SENSE.oracleId}#gt1`, SIXTH_SENSE.name);

export const SIXTH_SENSE_SCRIPT: CardScript = {
  oracleId: SIXTH_SENSE.oracleId,
  name: SIXTH_SENSE.name,
  triggers: [
    {
      abilityId: 'gt1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Sixth Sense - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_1 });
      },
    },
  ],
};
