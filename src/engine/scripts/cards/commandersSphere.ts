// `Commander's Sphere` — "{T}: Add one mana of any color in your commander's
// color identity.\nSacrifice this artifact: Draw a card." The identity-scoped
// mana line is the engine's (D110's scopes); the def owes the FREE
// self-sacrifice draw as ability 1. M6.4j, D167.

import { COMMANDER_S_SPHERE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  COMMANDER_S_SPHERE,
  "{T}: Add one mana of any color in your commander's color identity.\nSacrifice this artifact: Draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const COMMANDERS_SPHERE_SCRIPT: CardScript = {
  oracleId: COMMANDER_S_SPHERE.oracleId,
  name: COMMANDER_S_SPHERE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${COMMANDER_S_SPHERE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
