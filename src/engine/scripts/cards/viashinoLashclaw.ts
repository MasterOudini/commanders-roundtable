// `Viashino Lashclaw` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { VIASHINO_LASHCLAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_LASHCLAW, "{T}, Discard a card: Creatures you control gain haste until end of turn.");

export const VIASHINO_LASHCLAW_SCRIPT: CardScript = {
  oracleId: VIASHINO_LASHCLAW.oracleId,
  name: VIASHINO_LASHCLAW.name,
  activated: [
    {
      ref: `${VIASHINO_LASHCLAW.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["haste"] });
        }
        return out;
      },
    },
  ],
};
