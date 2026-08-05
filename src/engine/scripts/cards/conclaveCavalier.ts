// `Conclave Cavalier` — "Vigilance\nWhen this creature dies, create two 2/2
// green and white Elf Knight creature tokens with vigilance." A dies
// MULTI-TOKEN through D164's advancing allocator. M6.4j, D167.

import { CONCLAVE_CAVALIER } from '../../../data/fixtures/engineCards';
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
  CONCLAVE_CAVALIER,
  'Vigilance\nWhen this creature dies, create two 2/2 green and white Elf Knight creature tokens with vigilance.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ELF_KNIGHT = tokenRef('Elf Knight|2/2|GW|Creature|vigilance');

export const CONCLAVE_CAVALIER_SCRIPT: CardScript = {
  oracleId: CONCLAVE_CAVALIER.oracleId,
  name: CONCLAVE_CAVALIER.name,
  triggers: [
    {
      abilityId: 'dies',
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
      label: () => 'Conclave Cavalier — create two 2/2 Elf Knights',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: ELF_KNIGHT.oracleId,
          printingId: ELF_KNIGHT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
