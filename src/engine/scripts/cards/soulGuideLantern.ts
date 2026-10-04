// `Soul-Guide Lantern` - a etb trigger vocab, an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_GUIDE_LANTERN } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SOUL_GUIDE_LANTERN, "When this artifact enters, exile target card from a graveyard.\n{T}, Sacrifice this artifact: Exile each opponent's graveyard.\n{1}, {T}, Sacrifice this artifact: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target card from a graveyard.", SOUL_GUIDE_LANTERN.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target card from a graveyard.");
const VOCAB_A0 = vocabularyEffects("Exile each opponent's graveyard.", SOUL_GUIDE_LANTERN.name);
const VOCAB_T_A0 = vocabularyTargets("Exile each opponent's graveyard.");

export const SOUL_GUIDE_LANTERN_SCRIPT: CardScript = {
  oracleId: SOUL_GUIDE_LANTERN.oracleId,
  name: SOUL_GUIDE_LANTERN.name,
  activated: [
    {
      ref: `${SOUL_GUIDE_LANTERN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SOUL_GUIDE_LANTERN.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Soul-Guide Lantern - Exile target card from a graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
