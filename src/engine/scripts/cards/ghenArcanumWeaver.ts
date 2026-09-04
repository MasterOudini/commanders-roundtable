// `Ghen, Arcanum Weaver` - reanimate on "Return target enchantment card from your graveyard to the battlefield": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { GHEN_ARCANUM_WEAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHEN_ARCANUM_WEAVER, "{R}{W}{B}, {T}, Sacrifice an enchantment: Return target enchantment card from your graveyard to the battlefield.");
const TEXT = PRINTED;

export const GHEN_ARCANUM_WEAVER_SCRIPT: CardScript = {
  oracleId: GHEN_ARCANUM_WEAVER.oracleId,
  name: GHEN_ARCANUM_WEAVER.name,
  activated: [
    {
      ref: `${GHEN_ARCANUM_WEAVER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
};
