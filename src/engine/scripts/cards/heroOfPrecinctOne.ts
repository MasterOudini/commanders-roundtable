// `Hero of Precinct One` — "Whenever you cast a multicolored spell, create a
// 1/1 white Human creature token." The first MULTICOLORED cast filter:
// D'Avenant Trapper's access to the face actually cast, with the colour
// COUNT as the question — two or more printed colours on that face. Colour
// identity would be wrong here (a mono-colour card with a hybrid identity is
// not a multicolored SPELL). M6.4w, D179.

import { HERO_OF_PRECINCT_ONE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  HERO_OF_PRECINCT_ONE,
  'Whenever you cast a multicolored spell, create a 1/1 white Human creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN = tokenRef('Human|1/1|W|Creature|');

export const HERO_OF_PRECINCT_ONE_SCRIPT: CardScript = {
  oracleId: HERO_OF_PRECINCT_ONE.oracleId,
  name: HERO_OF_PRECINCT_ONE.name,
  triggers: [
    {
      abilityId: 'cast',
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
        const face = faceOf(oc, ev.obj.faceIndex);
        return face.colors.length >= 2;
      },
      label: () => 'Hero of Precinct One — create a 1/1 Human',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN.oracleId,
          printingId: HUMAN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
