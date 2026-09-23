// `Stormcaller's Boon` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMCALLER_S_BOON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORMCALLER_S_BOON, "Sacrifice this enchantment: Creatures you control gain flying until end of turn.\nCascade (When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the exiled cards on the bottom in a random order.)");
const LINES = PRINTED.split('\n');

export const STORMCALLERS_BOON_SCRIPT: CardScript = {
  oracleId: STORMCALLER_S_BOON.oracleId,
  name: STORMCALLER_S_BOON.name,
  activated: [
    {
      ref: `${STORMCALLER_S_BOON.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["flying"] });
        }
        return out;
      },
    },
  ],
};
