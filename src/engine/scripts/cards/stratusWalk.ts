// `Stratus Walk` - a etb trigger draw, a static attachedStatic, a static attachedCombat
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRATUS_WALK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STRATUS_WALK, "Enchant creature\nWhen this Aura enters, draw a card.\nEnchanted creature has flying. (It can't be blocked except by creatures with flying or reach.)\nEnchanted creature can block only creatures with flying.");
const LINES = PRINTED.split('\n');

export const STRATUS_WALK_SCRIPT: CardScript = {
  oracleId: STRATUS_WALK.oracleId,
  name: STRATUS_WALK.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Stratus Walk - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
  combat: [
    {
      abilityId: 'attached-combat-3',
      text: LINES[3] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== ctx.state.cards[self]?.attachedTo || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
