// `Bebop, Warthog Warrior` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEBOP_WARTHOG_WARRIOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(BEBOP_WARTHOG_WARRIOR, "Menace (This creature can't be blocked except by two or more creatures.)\nRhinos you control have menace.\nSwampcycling {2} ({2}, Discard this card: Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

export const BEBOP_WARTHOG_WARRIOR_SCRIPT: CardScript = {
  oracleId: BEBOP_WARTHOG_WARRIOR.oracleId,
  name: BEBOP_WARTHOG_WARRIOR.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Rhino") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
