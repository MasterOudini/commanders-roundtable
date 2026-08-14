// `Knight of Doves` — "Whenever an enchantment you control is put into a
// graveyard from the battlefield, create a 1/1 white Bird creature token
// with flying." Golgari Germination's controlled dies watcher with
// ENCHANTMENT in place of nontoken-creature. M6.4ab, D184.

import { KNIGHT_OF_DOVES } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  KNIGHT_OF_DOVES,
  'Whenever an enchantment you control is put into a graveyard from the battlefield, create a 1/1 white Bird creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BIRD = tokenRef('Bird|1/1|W|Creature|flying');

export const KNIGHT_OF_DOVES_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_DOVES.oracleId,
  name: KNIGHT_OF_DOVES.name,
  triggers: [
    {
      abilityId: 'enchantment-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Enchantment');
        }),
      label: () => 'Knight of Doves — create a 1/1 flying Bird',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BIRD.oracleId,
          printingId: BIRD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
