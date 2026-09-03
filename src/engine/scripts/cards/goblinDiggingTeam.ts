// `Goblin Digging Team` - destroy on "Destroy target Wall": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { GOBLIN_DIGGING_TEAM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_DIGGING_TEAM, "{T}, Sacrifice this creature: Destroy target Wall.");
const TEXT = PRINTED;

export const GOBLIN_DIGGING_TEAM_SCRIPT: CardScript = {
  oracleId: GOBLIN_DIGGING_TEAM.oracleId,
  name: GOBLIN_DIGGING_TEAM.name,
  activated: [
    {
      ref: `${GOBLIN_DIGGING_TEAM.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b - an indestructible permanent is not destroyed.
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
