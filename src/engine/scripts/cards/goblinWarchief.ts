// `Goblin Warchief` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_WARCHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_WARCHIEF, "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.");
const LINES = PRINTED.split('\n');

export const GOBLIN_WARCHIEF_SCRIPT: CardScript = {
  oracleId: GOBLIN_WARCHIEF.oracleId,
  name: GOBLIN_WARCHIEF.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Goblin") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
