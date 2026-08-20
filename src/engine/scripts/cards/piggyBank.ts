// `Piggy Bank` — "When this creature dies, create a Treasure token."
// Jewel-Eyed Cobra's line on a Boar Toy. D233.

import { PIGGY_BANK } from '../../../data/fixtures/engineCards';
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
  PIGGY_BANK,
  'When this creature dies, create a Treasure token. ' +
    "(It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const PIGGY_BANK_SCRIPT: CardScript = {
  oracleId: PIGGY_BANK.oracleId,
  name: PIGGY_BANK.name,
  triggers: [
    {
      abilityId: 'dies-treasure',
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
      label: () => 'Piggy Bank — create a Treasure token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: TREASURE.oracleId,
          printingId: TREASURE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
