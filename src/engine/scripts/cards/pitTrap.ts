// `Pit Trap` — destroy on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291), the keyword D289's. Generated from one table row (D292).

import { PIT_TRAP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PIT_TRAP, "{2}, {T}, Sacrifice this artifact: Destroy target attacking creature without flying. It can't be regenerated.");
const TEXT = PRINTED;

export const PIT_TRAP_SCRIPT: CardScript = {
  oracleId: PIT_TRAP.oracleId,
  name: PIT_TRAP.name,
  activated: [
    {
      ref: `${PIT_TRAP.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
