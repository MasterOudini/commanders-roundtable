// `Mausoleum Guard` — "When this creature dies, create two 1/1 white Spirit
// creature tokens with flying." Two DISTINCT Spirits off D164's allocator, on
// the tmm2 pin Field of Souls already pays with. M6.4ad, D186.

import { MAUSOLEUM_GUARD } from '../../../data/fixtures/engineCards';
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
  MAUSOLEUM_GUARD,
  'When this creature dies, create two 1/1 white Spirit creature tokens with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

export const MAUSOLEUM_GUARD_SCRIPT: CardScript = {
  oracleId: MAUSOLEUM_GUARD.oracleId,
  name: MAUSOLEUM_GUARD.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Mausoleum Guard — create two 1/1 Spirits with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
