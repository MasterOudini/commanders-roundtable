// `Sol'kanar the Swamp King` — "Whenever a player casts a black spell, you
// gain 1 life." Insight's color read with NO controller filter: ANY
// player's black cast pays, the caster's own included. D249.

import { SOL_KANAR_THE_SWAMP_KING } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  SOL_KANAR_THE_SWAMP_KING,
  "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\n" +
    'Whenever a player casts a black spell, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SOLKANAR_THE_SWAMP_KING_SCRIPT: CardScript = {
  oracleId: SOL_KANAR_THE_SWAMP_KING.oracleId,
  name: SOL_KANAR_THE_SWAMP_KING.name,
  triggers: [
    {
      abilityId: 'black-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).colors.includes('B');
      },
      label: () => "Sol'kanar the Swamp King — you gain 1 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
