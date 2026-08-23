// `Waterwind Scout` — flying plus the ETB Map token, on the pin the table
// already holds. The keyword line never counts, so the def's text is
// `split[1]`. D268.

import { WATERWIND_SCOUT } from '../../../data/fixtures/engineCards';
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
  WATERWIND_SCOUT,
  'Flying\nWhen this creature enters, create a Map token. (It\'s an artifact with "{1}, {T}, Sacrifice this token: Target creature you control explores. Activate only as a sorcery.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MAP = tokenRef('Map|/||Artifact|');

export const WATERWIND_SCOUT_SCRIPT: CardScript = {
  oracleId: WATERWIND_SCOUT.oracleId,
  name: WATERWIND_SCOUT.name,
  triggers: [
    {
      abilityId: 'etb-map',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Waterwind Scout — create a Map token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MAP.oracleId,
          printingId: MAP.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
