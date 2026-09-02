// `Sunbeam Spellbomb` — "{W}, Sacrifice this artifact: You gain 5 life.\n
// {1}, Sacrifice this artifact: Draw a card." Aether Spellbomb's two
// self-sacrifice activations (D272), each charged at activation (D159):
// 5 life, or a card. D281.

import { SUNBEAM_SPELLBOMB } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  SUNBEAM_SPELLBOMB,
  '{W}, Sacrifice this artifact: You gain 5 life.\n{1}, Sacrifice this artifact: Draw a card.',
);
const GAIN = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const SUNBEAM_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: SUNBEAM_SPELLBOMB.oracleId,
  name: SUNBEAM_SPELLBOMB.name,
  activated: [
    {
      ref: `${SUNBEAM_SPELLBOMB.oracleId}#a0`,
      text: GAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
      },
    },
    {
      ref: `${SUNBEAM_SPELLBOMB.oracleId}#a1`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
