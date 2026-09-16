// `Ice Flan` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICE_FLAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICE_FLAN, "When this creature enters, tap target artifact or creature an opponent controls. Put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)\nIslandcycling {2} ({2}, Discard this card: Search your library for an Island card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Tap target artifact or creature an opponent controls. Put a stun counter on it.", ICE_FLAN.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target artifact or creature an opponent controls. Put a stun counter on it.");

export const ICE_FLAN_SCRIPT: CardScript = {
  oracleId: ICE_FLAN.oracleId,
  name: ICE_FLAN.name,
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
      label: () => "Ice Flan - Tap target artifact or creature an opponent controls. Put a stun counter on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
