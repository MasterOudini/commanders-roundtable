// `Sidisi's Faithful` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIDISI_S_FAITHFUL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIDISI_S_FAITHFUL, "Exploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature to its owner's hand.", SIDISI_S_FAITHFUL.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature to its owner's hand.");

export const SIDISIS_FAITHFUL_SCRIPT: CardScript = {
  oracleId: SIDISI_S_FAITHFUL.oracleId,
  name: SIDISI_S_FAITHFUL.name,
  triggers: [
    {
      abilityId: 'exploits-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Sidisi's Faithful - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
