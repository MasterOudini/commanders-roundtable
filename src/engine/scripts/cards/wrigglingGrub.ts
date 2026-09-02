// `Wriggling Grub` — dies → TWO 1/1 black-and-green Worms with DISTINCT ids
// through D164's allocator, `looksBack` because the Grub is already in the
// graveyard when its death is seen. The Worm printing is one of this batch's
// four NEW pins (teve 6). D271.

import { WRIGGLING_GRUB } from '../../../data/fixtures/engineCards';
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
  WRIGGLING_GRUB,
  'When this creature dies, create two 1/1 black and green Worm creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const WORM = tokenRef('Worm|1/1|BG|Creature|');

export const WRIGGLING_GRUB_SCRIPT: CardScript = {
  oracleId: WRIGGLING_GRUB.oracleId,
  name: WRIGGLING_GRUB.name,
  triggers: [
    {
      abilityId: 'dies-worms',
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
      label: () => 'Wriggling Grub — create two 1/1 Worm creature tokens',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: WORM.oracleId,
          printingId: WORM.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
