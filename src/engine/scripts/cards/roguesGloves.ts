// `Rogue's Gloves` - a equippedCreatureCombatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROGUE_S_GLOVES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROGUE_S_GLOVES, "Whenever equipped creature deals combat damage to a player, you may draw a card.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const ROGUES_GLOVES_SCRIPT: CardScript = {
  oracleId: ROGUE_S_GLOVES.oracleId,
  name: ROGUE_S_GLOVES.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Rogue's Gloves - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
