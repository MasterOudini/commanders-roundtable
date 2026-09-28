// `Majestic Auricorn` - a mutates trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAJESTIC_AURICORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAJESTIC_AURICORN, "Mutate {3}{W} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nVigilance\nWhenever this creature mutates, you gain 4 life.");
const LINES = PRINTED.split('\n');

export const MAJESTIC_AURICORN_SCRIPT: CardScript = {
  oracleId: MAJESTIC_AURICORN.oracleId,
  name: MAJESTIC_AURICORN.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Majestic Auricorn - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
      },
    },
  ],
};
