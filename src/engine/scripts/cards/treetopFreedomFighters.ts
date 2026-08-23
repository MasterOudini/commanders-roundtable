// `Treetop Freedom Fighters` — haste line plus the ETB Ally. The keyword line
// never counts, so the def's text is `split[1]`. D262.

import { TREETOP_FREEDOM_FIGHTERS } from '../../../data/fixtures/engineCards';
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
  TREETOP_FREEDOM_FIGHTERS,
  'Haste\nWhen this creature enters, create a 1/1 white Ally creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const ALLY = tokenRef('Ally|1/1|W|Creature|');

export const TREETOP_FREEDOM_FIGHTERS_SCRIPT: CardScript = {
  oracleId: TREETOP_FREEDOM_FIGHTERS.oracleId,
  name: TREETOP_FREEDOM_FIGHTERS.name,
  triggers: [
    {
      abilityId: 'etb-ally',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Treetop Freedom Fighters — create a 1/1 Ally',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ALLY.oracleId,
          printingId: ALLY.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
