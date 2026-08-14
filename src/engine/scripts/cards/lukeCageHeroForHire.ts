// `Luke Cage, Hero for Hire` — "At the beginning of combat on your turn,
// create a Treasure token." Eidolon of Inspiration's step-and-active filter
// paying Treasure, no aim needed. M6.4ac, D185.

import { LUKE_CAGE_HERO_FOR_HIRE } from '../../../data/fixtures/engineCards';
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
  LUKE_CAGE_HERO_FOR_HIRE,
  'Trample\nAt the beginning of combat on your turn, create a Treasure token. ' +
    '(It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const LUKE_CAGE_HERO_FOR_HIRE_SCRIPT: CardScript = {
  oracleId: LUKE_CAGE_HERO_FOR_HIRE.oracleId,
  name: LUKE_CAGE_HERO_FOR_HIRE.name,
  triggers: [
    {
      abilityId: 'begin-combat',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'beginCombat' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Luke Cage — create a Treasure token',
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
