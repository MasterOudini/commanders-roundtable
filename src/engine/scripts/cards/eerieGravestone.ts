// `Eerie Gravestone` - a etb trigger draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EERIE_GRAVESTONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EERIE_GRAVESTONE, "When this artifact enters, draw a card.\n{1}{B}, Sacrifice this artifact: Mill four cards. You may put a creature card from among them into your hand. (To mill four cards, put the top four cards of your library into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Mill four cards. You may put a creature card from among them into your hand.", EERIE_GRAVESTONE.name);
const VOCAB_T_A0 = vocabularyTargets("Mill four cards. You may put a creature card from among them into your hand.");

export const EERIE_GRAVESTONE_SCRIPT: CardScript = {
  oracleId: EERIE_GRAVESTONE.oracleId,
  name: EERIE_GRAVESTONE.name,
  activated: [
    {
      ref: `${EERIE_GRAVESTONE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
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
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eerie Gravestone - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
