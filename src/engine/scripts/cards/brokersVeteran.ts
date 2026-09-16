// `Brokers Veteran` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BROKERS_VETERAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BROKERS_VETERAN, "When this creature dies, put a shield counter on target creature you control. (If it would be dealt damage or destroyed, remove a shield counter from it instead.)");

const VOCAB_L0 = vocabularyEffects("Put a shield counter on target creature you control.", BROKERS_VETERAN.name);
const VOCAB_T_L0 = vocabularyTargets("Put a shield counter on target creature you control.");

export const BROKERS_VETERAN_SCRIPT: CardScript = {
  oracleId: BROKERS_VETERAN.oracleId,
  name: BROKERS_VETERAN.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Brokers Veteran - Put a shield counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
