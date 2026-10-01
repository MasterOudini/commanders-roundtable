// `Crookclaw Transmuter` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROOKCLAW_TRANSMUTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROOKCLAW_TRANSMUTER, "Flash\nFlying\nWhen this creature enters, switch target creature's power and toughness until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Switch target creature's power and toughness until end of turn.", CROOKCLAW_TRANSMUTER.name);
const VOCAB_T_L2 = vocabularyTargets("Switch target creature's power and toughness until end of turn.");

export const CROOKCLAW_TRANSMUTER_SCRIPT: CardScript = {
  oracleId: CROOKCLAW_TRANSMUTER.oracleId,
  name: CROOKCLAW_TRANSMUTER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Crookclaw Transmuter - Switch target creature's power and toughness until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
