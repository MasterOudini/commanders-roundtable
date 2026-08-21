// `Spellkeeper Weird` — "{2}, {T}, Sacrifice this creature: Return target
// instant or sorcery card from your graveyard to your hand." The self-sac
// graveyard return with BOTH cardTypes enforced (the probed receipt). D250.

import { SPELLKEEPER_WEIRD } from '../../../data/fixtures/engineCards';
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
  SPELLKEEPER_WEIRD,
  '{2}, {T}, Sacrifice this creature: Return target instant or sorcery card from your graveyard to your hand.',
);

export const SPELLKEEPER_WEIRD_SCRIPT: CardScript = {
  oracleId: SPELLKEEPER_WEIRD.oracleId,
  name: SPELLKEEPER_WEIRD.name,
  activated: [
    {
      ref: `${SPELLKEEPER_WEIRD.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        const graveOwner = card.zone.player;
        if (!graveOwner) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: graveOwner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
