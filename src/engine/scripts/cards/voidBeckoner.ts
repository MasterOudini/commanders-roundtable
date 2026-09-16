// `Void Beckoner` - a cycleThisCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOID_BECKONER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOID_BECKONER, "Deathtouch\nCycling {2}{B} ({2}{B}, Discard this card: Draw a card.)\nWhen you cycle this card, put a deathtouch counter on target creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a deathtouch counter on target creature you control.", VOID_BECKONER.name);
const VOCAB_T_L2 = vocabularyTargets("Put a deathtouch counter on target creature you control.");

export const VOID_BECKONER_SCRIPT: CardScript = {
  oracleId: VOID_BECKONER.oracleId,
  name: VOID_BECKONER.name,
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
      label: () => "Void Beckoner - Put a deathtouch counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
