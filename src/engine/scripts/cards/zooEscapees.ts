// `Zoo Escapees` — "When this creature LEAVES the battlefield, create a
// Mutagen token." A leaves-the-battlefield watcher: ANY destination, not just
// the graveyard (City Pigeon, Brandywine Farmer are the precedents), and
// `looksBack` because the Escapees are already gone when the move is seen.
// D271.

import { ZOO_ESCAPEES } from '../../../data/fixtures/engineCards';
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
  ZOO_ESCAPEES,
  'When this creature leaves the battlefield, create a Mutagen token. (It\'s an artifact with "{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MUTAGEN = tokenRef('Mutagen|/||Artifact|');

export const ZOO_ESCAPEES_SCRIPT: CardScript = {
  oracleId: ZOO_ESCAPEES.oracleId,
  name: ZOO_ESCAPEES.name,
  triggers: [
    {
      abilityId: 'ltb-mutagen',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield',
        ),
      label: () => 'Zoo Escapees — create a Mutagen token',
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
