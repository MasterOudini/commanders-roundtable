// `Protector of Gondor` — "When this creature enters, create a 1/1
// white Human Soldier creature token." On the committed tthb pin. D235.

import { PROTECTOR_OF_GONDOR } from '../../../data/fixtures/engineCards';
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
  PROTECTOR_OF_GONDOR,
  'When this creature enters, create a 1/1 white Human Soldier creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN_SOLDIER = tokenRef('Human Soldier|1/1|W|Creature|');

export const PROTECTOR_OF_GONDOR_SCRIPT: CardScript = {
  oracleId: PROTECTOR_OF_GONDOR.oracleId,
  name: PROTECTOR_OF_GONDOR.name,
  triggers: [
    {
      abilityId: 'etb-soldier',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Protector of Gondor — create a 1/1 white Human Soldier token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN_SOLDIER.oracleId,
          printingId: HUMAN_SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
