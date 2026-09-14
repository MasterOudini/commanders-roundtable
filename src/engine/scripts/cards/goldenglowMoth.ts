// `Goldenglow Moth` - a blocks trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLDENGLOW_MOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLDENGLOW_MOTH, "Flying\nWhenever this creature blocks, you may gain 4 life.");
const LINES = PRINTED.split('\n');

export const GOLDENGLOW_MOTH_SCRIPT: CardScript = {
  oracleId: GOLDENGLOW_MOTH.oracleId,
  name: GOLDENGLOW_MOTH.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Goldenglow Moth - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
      },
    },
  ],
};
