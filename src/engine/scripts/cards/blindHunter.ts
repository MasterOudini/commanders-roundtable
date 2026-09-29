// `Blind Hunter` - a etb trigger vocab, a hauntedDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIND_HUNTER } from '../../../data/fixtures/engineCards';
import { hauntedDied } from '../../keywordTriggers';
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

const PRINTED = printed(BLIND_HUNTER, "Flying\nHaunt (When this creature dies, exile it haunting target creature.)\nWhen this creature enters or the creature it haunts dies, target player loses 2 life and you gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target player loses 2 life and you gain 2 life.", BLIND_HUNTER.name);
const VOCAB_T_L2 = vocabularyTargets("Target player loses 2 life and you gain 2 life.");

export const BLIND_HUNTER_SCRIPT: CardScript = {
  oracleId: BLIND_HUNTER.oracleId,
  name: BLIND_HUNTER.name,
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
      label: () => "Blind Hunter - Target player loses 2 life and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'hauntedDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ["exile"],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (ctx, self, ev) => hauntedDied(ctx, self, ev),
      label: () => "Blind Hunter - Target player loses 2 life and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
