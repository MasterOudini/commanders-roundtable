// `Grappling Kraken` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAPPLING_KRAKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAPPLING_KRAKEN, "Landfall — Whenever a land you control enters, tap target creature an opponent controls and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)");

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls and put a stun counter on it.", GRAPPLING_KRAKEN.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls and put a stun counter on it.");

export const GRAPPLING_KRAKEN_SCRIPT: CardScript = {
  oracleId: GRAPPLING_KRAKEN.oracleId,
  name: GRAPPLING_KRAKEN.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Grappling Kraken - Tap target creature an opponent controls and put a stun counter on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
