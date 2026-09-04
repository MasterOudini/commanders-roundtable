// `Dauntless Escort` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAUNTLESS_ESCORT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAUNTLESS_ESCORT, "Sacrifice this creature: Creatures you control gain indestructible until end of turn.");

export const DAUNTLESS_ESCORT_SCRIPT: CardScript = {
  oracleId: DAUNTLESS_ESCORT.oracleId,
  name: DAUNTLESS_ESCORT.name,
  activated: [
    {
      ref: `${DAUNTLESS_ESCORT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["indestructible"] });
        }
        return out;
      },
    },
  ],
};
