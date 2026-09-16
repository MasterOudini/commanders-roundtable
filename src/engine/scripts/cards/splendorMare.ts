// `Splendor Mare` - a cycleThisCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPLENDOR_MARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPLENDOR_MARE, "Lifelink\nCycling {1}{W} ({1}{W}, Discard this card: Draw a card.)\nWhen you cycle this card, put a lifelink counter on target creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a lifelink counter on target creature you control.", SPLENDOR_MARE.name);
const VOCAB_T_L2 = vocabularyTargets("Put a lifelink counter on target creature you control.");

export const SPLENDOR_MARE_SCRIPT: CardScript = {
  oracleId: SPLENDOR_MARE.oracleId,
  name: SPLENDOR_MARE.name,
  triggers: [
    {
      abilityId: 'cycleThisCard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Splendor Mare - Put a lifelink counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
