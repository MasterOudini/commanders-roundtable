// `Star Whale` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAR_WHALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAR_WHALE, "Flying, vigilance\nOther creatures you control have ward {2}.\nSuspend 6—{1}{U} (Rather than cast this card from your hand, you may pay {1}{U} and exile it with six time counters on it. At the beginning of your upkeep, remove a time counter. When the last is removed, you may cast it without paying its mana cost. It has haste.)");
const LINES = PRINTED.split('\n');

export const STAR_WHALE_SCRIPT: CardScript = {
  oracleId: STAR_WHALE.oracleId,
  name: STAR_WHALE.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.wards.push({ wardCost: { generic: 2, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 2, raw: '{2}' }, wardLife: 0 });
      },
    },
  ],
};
