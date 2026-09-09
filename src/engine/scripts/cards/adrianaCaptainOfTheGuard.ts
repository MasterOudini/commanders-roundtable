// `Adriana, Captain of the Guard` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADRIANA_CAPTAIN_OF_THE_GUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADRIANA_CAPTAIN_OF_THE_GUARD, "Melee (Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.)\nOther creatures you control have melee. (If a creature has multiple instances of melee, each triggers separately.)");
const LINES = PRINTED.split('\n');

export const ADRIANA_CAPTAIN_OF_THE_GUARD_SCRIPT: CardScript = {
  oracleId: ADRIANA_CAPTAIN_OF_THE_GUARD.oracleId,
  name: ADRIANA_CAPTAIN_OF_THE_GUARD.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("melee");
      },
    },
  ],
};
