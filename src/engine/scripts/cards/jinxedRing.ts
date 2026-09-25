// `Jinxed Ring` - a cardPutIntoGraveyard trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JINXED_RING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(JINXED_RING, "Whenever a nontoken permanent is put into your graveyard from the battlefield, this artifact deals 1 damage to you.\nSacrifice a creature: Target opponent gains control of this artifact. (This effect lasts indefinitely.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("This artifact deals 1 damage to you.", JINXED_RING.name);
const VOCAB_T_L0 = vocabularyTargets("This artifact deals 1 damage to you.");
const VOCAB_A0 = vocabularyEffects("Target opponent gains control of this artifact.", JINXED_RING.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent gains control of this artifact.");

export const JINXED_RING_SCRIPT: CardScript = {
  oracleId: JINXED_RING.oracleId,
  name: JINXED_RING.name,
  activated: [
    {
      ref: `${JINXED_RING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.to.player === ctx.query.controllerOf(self) && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Jinxed Ring - This artifact deals 1 damage to you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
