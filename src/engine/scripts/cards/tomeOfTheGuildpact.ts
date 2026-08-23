// `Tome of the Guildpact` — Hero of Precinct One's multicolored cast filter
// (D179) on an ARTIFACT, beside an engine mana line. TWO printed lines, and
// this def claims ONE: the "add one mana of any color" line is the engine's.
//
// ⚠️ The colour count is taken off the FACE ACTUALLY CAST, not the card's
// colour identity — a hybrid mono-colour card is not a multicolored spell,
// which is the whole point of D179's filter. D261.

import { TOME_OF_THE_GUILDPACT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  TOME_OF_THE_GUILDPACT,
  'Whenever you cast a multicolored spell, draw a card.\n{T}: Add one mana of any color.',
);
const TEXT = PRINTED.split('\n')[0] as string;

export const TOME_OF_THE_GUILDPACT_SCRIPT: CardScript = {
  oracleId: TOME_OF_THE_GUILDPACT.oracleId,
  name: TOME_OF_THE_GUILDPACT.name,
  triggers: [
    {
      abilityId: 'multicolored-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).colors.length >= 2;
      },
      label: () => 'Tome of the Guildpact — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
