// `Strands of Night` — the THREE-PART activation cost: mana, two life, and
// a sacrificed Swamp, all charged before the reanimation resolves. The
// probe showed the whole line parses as ONE activated ability, so the def
// claims it whole and the engine charges every part. D254.

import { STRANDS_OF_NIGHT } from '../../../data/fixtures/engineCards';
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
  STRANDS_OF_NIGHT,
  '{B}{B}, Pay 2 life, Sacrifice a Swamp: Return target creature card from your graveyard to the battlefield.',
);

export const STRANDS_OF_NIGHT_SCRIPT: CardScript = {
  oracleId: STRANDS_OF_NIGHT.oracleId,
  name: STRANDS_OF_NIGHT.name,
  activated: [
    {
      ref: `${STRANDS_OF_NIGHT.oracleId}#a0`,
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
                to: { kind: 'battlefield', player: obj.controller },
              },
            ],
          },
        ];
      },
    },
  ],
};
