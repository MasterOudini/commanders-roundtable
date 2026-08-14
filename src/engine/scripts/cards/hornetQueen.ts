// `Hornet Queen` — "When this creature enters, create four 1/1 green Insect
// creature tokens with flying and deathtouch." The largest single token drop
// a script has made: four DISTINCT ids through D164's allocator, on a NEW
// pin whose keywords are its identity (D131). M6.4x, D180.

import { HORNET_QUEEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  HORNET_QUEEN,
  'Flying, deathtouch\nWhen this creature enters, create four 1/1 green Insect creature tokens with flying and deathtouch.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const INSECT = tokenRef('Insect|1/1|G|Creature|deathtouch|flying');

export const HORNET_QUEEN_SCRIPT: CardScript = {
  oracleId: HORNET_QUEEN.oracleId,
  name: HORNET_QUEEN.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Hornet Queen — create four 1/1 Insects',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1, 2, 3].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: INSECT.oracleId,
          printingId: INSECT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
