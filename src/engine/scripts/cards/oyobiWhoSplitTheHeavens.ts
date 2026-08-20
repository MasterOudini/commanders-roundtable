// `Oyobi, Who Split the Heavens` — "Whenever you cast a Spirit or Arcane
// spell, create a 3/3 white Spirit creature token with flying."
// Briarknit's subtype cast filter paying a big Spirit. D231.

import { OYOBI_WHO_SPLIT_THE_HEAVENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  OYOBI_WHO_SPLIT_THE_HEAVENS,
  'Flying\nWhenever you cast a Spirit or Arcane spell, create a 3/3 white Spirit creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|3/3|W|Creature|flying');

export const OYOBI_WHO_SPLIT_THE_HEAVENS_SCRIPT: CardScript = {
  oracleId: OYOBI_WHO_SPLIT_THE_HEAVENS.oracleId,
  name: OYOBI_WHO_SPLIT_THE_HEAVENS.name,
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
        const subtypes = faceOf(oc, ev.obj.faceIndex).typeLine.subtypes;
        return subtypes.includes('Spirit') || subtypes.includes('Arcane');
      },
      label: () => 'Oyobi, Who Split the Heavens — create a 3/3 Spirit with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
