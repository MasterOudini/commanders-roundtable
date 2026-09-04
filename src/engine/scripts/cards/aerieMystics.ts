// `Aerie Mystics` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AERIE_MYSTICS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AERIE_MYSTICS, "Flying\n{1}{G}{U}: Creatures you control gain shroud until end of turn. (They can't be the targets of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const AERIE_MYSTICS_SCRIPT: CardScript = {
  oracleId: AERIE_MYSTICS.oracleId,
  name: AERIE_MYSTICS.name,
  activated: [
    {
      ref: `${AERIE_MYSTICS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["shroud"] });
        }
        return out;
      },
    },
  ],
};
