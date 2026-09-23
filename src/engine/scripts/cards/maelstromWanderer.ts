// `Maelstrom Wanderer` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAELSTROM_WANDERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAELSTROM_WANDERER, "Creatures you control have haste.\nCascade, cascade (When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the exiled cards on the bottom in a random order. Then do it again.)");
const LINES = PRINTED.split('\n');

export const MAELSTROM_WANDERER_SCRIPT: CardScript = {
  oracleId: MAELSTROM_WANDERER.oracleId,
  name: MAELSTROM_WANDERER.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
