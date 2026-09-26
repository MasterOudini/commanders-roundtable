// `Unswerving Sloth` - a attacksWhileSaddled trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNSWERVING_SLOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNSWERVING_SLOTH, "Whenever this creature attacks while saddled, it gains indestructible until end of turn. Untap all creatures you control.\nSaddle 4 (Tap any number of other creatures you control with total power 4 or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ gains indestructible until end of turn. Untap all creatures you control.", UNSWERVING_SLOTH.name);
const VOCAB_T_L0 = vocabularyTargets("~ gains indestructible until end of turn. Untap all creatures you control.");

export const UNSWERVING_SLOTH_SCRIPT: CardScript = {
  oracleId: UNSWERVING_SLOTH.oracleId,
  name: UNSWERVING_SLOTH.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Unswerving Sloth - ~ gains indestructible until end of turn. Untap all creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
