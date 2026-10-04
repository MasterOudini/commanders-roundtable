// `Oakhame Ranger // Bring Back` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OAKHAME_RANGER_BRING_BACK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(OAKHAME_RANGER_BRING_BACK, "{T}: Creatures you control get +1/+1 until end of turn.\nCreate two 1/1 white Human creature tokens. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const OAKHAME_RANGER_BRING_BACK_SCRIPT: CardScript = {
  oracleId: OAKHAME_RANGER_BRING_BACK.oracleId,
  name: OAKHAME_RANGER_BRING_BACK.name,
  activated: [
    {
      ref: `${OAKHAME_RANGER_BRING_BACK.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1 });
        }
        return out;
      },
    },
  ],
};
