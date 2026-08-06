// `Crustacean Commando` — "When this creature enters, create a Mutagen
// token." The Mutagen is a predefined artifact whose ability is its OWN
// (D132): the card never states it, the printing carries it. M6.4l, D169.

import { CRUSTACEAN_COMMANDO } from '../../../data/fixtures/engineCards';
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
  CRUSTACEAN_COMMANDO,
  'When this creature enters, create a Mutagen token. (It\'s an artifact with "{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MUTAGEN = tokenRef('Mutagen|/||Artifact|');

export const CRUSTACEAN_COMMANDO_SCRIPT: CardScript = {
  oracleId: CRUSTACEAN_COMMANDO.oracleId,
  name: CRUSTACEAN_COMMANDO.name,
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
      label: () => 'Crustacean Commando — create a Mutagen token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MUTAGEN.oracleId,
          printingId: MUTAGEN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
