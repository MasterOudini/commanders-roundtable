// `Elderleaf Mentor` — "When this creature enters, create a 1/1 green Elf
// Warrior creature token." An ETB token on D160's Elf Warrior pin. M6.4q,
// D173.

import { ELDERLEAF_MENTOR } from '../../../data/fixtures/engineCards';
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
  ELDERLEAF_MENTOR,
  'When this creature enters, create a 1/1 green Elf Warrior creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ELF_WARRIOR = tokenRef('Elf Warrior|1/1|G|Creature|');

export const ELDERLEAF_MENTOR_SCRIPT: CardScript = {
  oracleId: ELDERLEAF_MENTOR.oracleId,
  name: ELDERLEAF_MENTOR.name,
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
      label: () => 'Elderleaf Mentor — create a 1/1 Elf Warrior',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ELF_WARRIOR.oracleId,
          printingId: ELF_WARRIOR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
