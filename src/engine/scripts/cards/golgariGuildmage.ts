// `Golgari Guildmage` — "{4}{B}, Sacrifice a creature: Return target
// creature card from your graveyard to your hand.\n{4}{G}: Put a +1/+1
// counter on target creature." The creature-sacrifice chooser (D168) paying
// for Strands of Night's graveyard aim (D254) with a HAND destination, and
// a plain counter (CountersChanged batches its changes). D275.

import { GOLGARI_GUILDMAGE } from '../../../data/fixtures/engineCards';
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
  GOLGARI_GUILDMAGE,
  '{4}{B}, Sacrifice a creature: Return target creature card from your graveyard to your hand.\n{4}{G}: Put a +1/+1 counter on target creature.',
);
const RETURN = PRINTED.split('\n')[0] as string;
const COUNTER = PRINTED.split('\n')[1] as string;

export const GOLGARI_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: GOLGARI_GUILDMAGE.oracleId,
  name: GOLGARI_GUILDMAGE.name,
  activated: [
    {
      ref: `${GOLGARI_GUILDMAGE.oracleId}#a0`,
      text: RETURN,
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
    {
      ref: `${GOLGARI_GUILDMAGE.oracleId}#a1`,
      text: COUNTER,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
};
