// `Sapseep Forest` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAPSEEP_FOREST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAPSEEP_FOREST, "({T}: Add {G}.)\nThis land enters tapped.\n{G}, {T}: You gain 1 life. Activate only if you control two or more green permanents.");
const LINES = PRINTED.split('\n');

export const SAPSEEP_FOREST_SCRIPT: CardScript = {
  oracleId: SAPSEEP_FOREST.oracleId,
  name: SAPSEEP_FOREST.name,
  activated: [
    {
      ref: `${SAPSEEP_FOREST.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
