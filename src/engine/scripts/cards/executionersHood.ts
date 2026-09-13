// `Executioner's Hood` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXECUTIONER_S_HOOD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXECUTIONER_S_HOOD, "Equipped creature has intimidate. (This creature can't be blocked except by artifact creatures and/or creatures that share a color with it.)\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const EXECUTIONERS_HOOD_SCRIPT: CardScript = {
  oracleId: EXECUTIONER_S_HOOD.oracleId,
  name: EXECUTIONER_S_HOOD.name,
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("intimidate");
      },
    },
  ],
};
