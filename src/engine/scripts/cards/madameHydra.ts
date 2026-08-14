// `Madame Hydra` — "Whenever you cast a Villain spell, create a 2/1 black
// Villain creature token with menace." The Villain-subtype cast-watcher
// paying in its own kind (the token pin is D160's). M6.4ac, D185.

import { MADAME_HYDRA } from '../../../data/fixtures/engineCards';
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
  MADAME_HYDRA,
  'Whenever you cast a Villain spell, create a 2/1 black Villain creature token with menace. ' +
    "(It can't be blocked except by two or more creatures.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const VILLAIN = tokenRef('Villain|2/1|B|Creature|menace');

export const MADAME_HYDRA_SCRIPT: CardScript = {
  oracleId: MADAME_HYDRA.oracleId,
  name: MADAME_HYDRA.name,
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
        return face.typeLine.subtypes.includes('Villain');
      },
      label: () => 'Madame Hydra — create a 2/1 Villain',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: VILLAIN.oracleId,
          printingId: VILLAIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
