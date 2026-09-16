// `Shipwreck Patrol` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHIPWRECK_PATROL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHIPWRECK_PATROL, "When this creature enters, tap target creature an opponent controls and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)");

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls and put a stun counter on it.", SHIPWRECK_PATROL.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls and put a stun counter on it.");

export const SHIPWRECK_PATROL_SCRIPT: CardScript = {
  oracleId: SHIPWRECK_PATROL.oracleId,
  name: SHIPWRECK_PATROL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Shipwreck Patrol - Tap target creature an opponent controls and put a stun counter on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
