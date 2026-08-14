// `Gingerbread Cabin` — Land — Forest, "This land enters tapped unless you
// control three or more other Forests.\nWhen this land enters untapped,
// create a Food token." Dwarven Mine's enters-UNTAPPED filter (D172) on a
// Forest count: line 2 is D135's `otherLandsOfType` board query, the mana
// line is the Forest subtype's own, and the def owes line 3, read off the
// AFTER state. M6.4t, D176.

import { GINGERBREAD_CABIN } from '../../../data/fixtures/engineCards';
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
  GINGERBREAD_CABIN,
  '({T}: Add {G}.)\nThis land enters tapped unless you control three or more other Forests.\nWhen this land enters untapped, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);
const TEXT = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FOOD = tokenRef('Food|/||Artifact|');

export const GINGERBREAD_CABIN_SCRIPT: CardScript = {
  oracleId: GINGERBREAD_CABIN.oracleId,
  name: GINGERBREAD_CABIN.name,
  triggers: [
    {
      abilityId: 'etb-untapped',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ctx.state.cards[self]?.tapped === false &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Gingerbread Cabin — create a Food',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FOOD.oracleId,
          printingId: FOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
