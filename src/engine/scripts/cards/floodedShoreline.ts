// `Flooded Shoreline` - an activation bounceTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOODED_SHORELINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOODED_SHORELINE, "{U}{U}, Return two Islands you control to their owner's hand: Return target creature to its owner's hand.");

export const FLOODED_SHORELINE_SCRIPT: CardScript = {
  oracleId: FLOODED_SHORELINE.oracleId,
  name: FLOODED_SHORELINE.name,
  activated: [
    {
      ref: `${FLOODED_SHORELINE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
