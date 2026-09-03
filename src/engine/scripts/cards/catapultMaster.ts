// `Catapult Master` — tapping five untapped Soldiers I control (the D286 tap
// chooser, count five) exiles a target creature.

import { CATAPULT_MASTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CATAPULT_MASTER, 'Tap five untapped Soldiers you control: Exile target creature.');

export const CATAPULT_MASTER_SCRIPT: CardScript = {
  oracleId: CATAPULT_MASTER.oracleId,
  name: CATAPULT_MASTER.name,
  activated: [
    {
      ref: `${CATAPULT_MASTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
