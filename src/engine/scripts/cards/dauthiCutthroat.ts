// `Dauthi Cutthroat` — Shadow is the engine's; the ability destroys a
// creature WITH SHADOW (a keyword qualifier beyond flying, D289).

import { DAUTHI_CUTTHROAT } from '../../../data/fixtures/engineCards';
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
  DAUTHI_CUTTHROAT,
  'Shadow (This creature can block or be blocked by only creatures with shadow.)\n{1}{B}, {T}: Destroy target creature with shadow.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DAUTHI_CUTTHROAT_SCRIPT: CardScript = {
  oracleId: DAUTHI_CUTTHROAT.oracleId,
  name: DAUTHI_CUTTHROAT.name,
  activated: [
    {
      ref: `${DAUTHI_CUTTHROAT.oracleId}#a0`,
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
