// `Soul of Theros` - an activation pumping its controller's creatures, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_OF_THEROS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_OF_THEROS, "Vigilance\n{4}{W}{W}: Creatures you control get +2/+2 and gain first strike and lifelink until end of turn.\n{4}{W}{W}, Exile this card from your graveyard: Creatures you control get +2/+2 and gain first strike and lifelink until end of turn.");
const LINES = PRINTED.split('\n');

export const SOUL_OF_THEROS_SCRIPT: CardScript = {
  oracleId: SOUL_OF_THEROS.oracleId,
  name: SOUL_OF_THEROS.name,
  activated: [
    {
      ref: `${SOUL_OF_THEROS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2, keywords: ["firstStrike", "lifelink"] });
        }
        return out;
      },
    },
    {
      ref: `${SOUL_OF_THEROS.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2, keywords: ["firstStrike", "lifelink"] });
        }
        return out;
      },
    },
  ],
};
