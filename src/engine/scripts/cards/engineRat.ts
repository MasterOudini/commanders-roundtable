// `Engine Rat` - an activation loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENGINE_RAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENGINE_RAT, "Deathtouch\n{5}{B}: Each opponent loses 2 life.");
const LINES = PRINTED.split('\n');

export const ENGINE_RAT_SCRIPT: CardScript = {
  oracleId: ENGINE_RAT.oracleId,
  name: ENGINE_RAT.name,
  activated: [
    {
      ref: `${ENGINE_RAT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        return out;
      },
    },
  ],
};
