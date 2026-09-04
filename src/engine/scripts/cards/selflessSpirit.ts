// `Selfless Spirit` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SELFLESS_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SELFLESS_SPIRIT, "Flying\nSacrifice this creature: Creatures you control gain indestructible until end of turn.");
const LINES = PRINTED.split('\n');

export const SELFLESS_SPIRIT_SCRIPT: CardScript = {
  oracleId: SELFLESS_SPIRIT.oracleId,
  name: SELFLESS_SPIRIT.name,
  activated: [
    {
      ref: `${SELFLESS_SPIRIT.oracleId}#a0`,
      text: LINES[1] as string,
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
