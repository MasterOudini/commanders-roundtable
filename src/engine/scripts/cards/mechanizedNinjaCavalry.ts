// `Mechanized Ninja Cavalry` — "When this creature enters, create a 1/1
// colorless Robot artifact creature token." The ETB token on the batch's new
// Robot pin; the {R/W} in its mana cost is a CAST cost the payment solver
// already charges. M6.4ad, D186.

import { MECHANIZED_NINJA_CAVALRY } from '../../../data/fixtures/engineCards';
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
  MECHANIZED_NINJA_CAVALRY,
  'When this creature enters, create a 1/1 colorless Robot artifact creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ROBOT = tokenRef('Robot|1/1||Artifact Creature|');

export const MECHANIZED_NINJA_CAVALRY_SCRIPT: CardScript = {
  oracleId: MECHANIZED_NINJA_CAVALRY.oracleId,
  name: MECHANIZED_NINJA_CAVALRY.name,
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
      label: () => 'Mechanized Ninja Cavalry — create a 1/1 Robot',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ROBOT.oracleId,
          printingId: ROBOT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
