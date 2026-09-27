// `Giant Ankheg` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_ANKHEG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIANT_ANKHEG, "Trample\nWard {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nOther creatures you control have trample and ward {2}.");
const LINES = PRINTED.split('\n');

export const GIANT_ANKHEG_SCRIPT: CardScript = {
  oracleId: GIANT_ANKHEG.oracleId,
  name: GIANT_ANKHEG.name,
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("trample");
        chars.wards.push({ wardCost: { generic: 2, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 2, raw: '{2}' }, wardLife: 0 });
      },
    },
  ],
};
