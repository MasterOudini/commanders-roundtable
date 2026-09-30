// `Dúnedain Blade` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { D_NEDAIN_BLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(D_NEDAIN_BLADE, "Equipped creature gets +2/+1.\nEquip Human {1}\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const D_NEDAIN_BLADE_SCRIPT: CardScript = {
  oracleId: D_NEDAIN_BLADE.oracleId,
  name: D_NEDAIN_BLADE.name,
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
