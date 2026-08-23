// `Twin-Silk Spider` — reach line plus the ETB Spider on the ALREADY PINNED
// 1/2 green reach token. The keyword line never counts, so the def's text is
// `split[1]`. D263.

import { TWIN_SILK_SPIDER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  TWIN_SILK_SPIDER,
  'Reach\nWhen this creature enters, create a 1/2 green Spider creature token with reach.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const SPIDER = tokenRef('Spider|1/2|G|Creature|reach');

export const TWIN_SILK_SPIDER_SCRIPT: CardScript = {
  oracleId: TWIN_SILK_SPIDER.oracleId,
  name: TWIN_SILK_SPIDER.name,
  triggers: [
    {
      abilityId: 'etb-spider',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Twin-Silk Spider — create a 1/2 Spider with reach',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIDER.oracleId,
          printingId: SPIDER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
