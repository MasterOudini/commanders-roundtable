// `Steadfast Unicorn` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEADFAST_UNICORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEADFAST_UNICORN, "{3}{W}: Creatures you control get +1/+1 and gain vigilance until end of turn. Activate only during your turn. (Attacking doesn't cause them to tap.)");

export const STEADFAST_UNICORN_SCRIPT: CardScript = {
  oracleId: STEADFAST_UNICORN.oracleId,
  name: STEADFAST_UNICORN.name,
  activated: [
    {
      ref: `${STEADFAST_UNICORN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["vigilance"] });
        }
        return out;
      },
    },
  ],
};
