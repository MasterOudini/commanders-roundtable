// `Pestered Wellguard` — "Whenever this creature becomes tapped, create a
// 1/1 blue and black Faerie creature token with flying." Emmara's
// becomes-tapped watcher paying a token. D232.

import { PESTERED_WELLGUARD } from '../../../data/fixtures/engineCards';
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
  PESTERED_WELLGUARD,
  'Whenever this creature becomes tapped, create a 1/1 blue and black Faerie creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FAERIE = tokenRef('Faerie|1/1|BU|Creature|flying');

export const PESTERED_WELLGUARD_SCRIPT: CardScript = {
  oracleId: PESTERED_WELLGUARD.oracleId,
  name: PESTERED_WELLGUARD.name,
  triggers: [
    {
      abilityId: 'tapped-faerie',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Pestered Wellguard — create a 1/1 Faerie with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FAERIE.oracleId,
          printingId: FAERIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
