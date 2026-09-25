// `Big Game Hunter` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BIG_GAME_HUNTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BIG_GAME_HUNTER, "When this creature enters, destroy target creature with power 4 or greater. It can't be regenerated.\nMadness {B} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Destroy target creature with power 4 or greater. It can't be regenerated.", BIG_GAME_HUNTER.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature with power 4 or greater. It can't be regenerated.");

export const BIG_GAME_HUNTER_SCRIPT: CardScript = {
  oracleId: BIG_GAME_HUNTER.oracleId,
  name: BIG_GAME_HUNTER.name,
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
      label: () => "Big Game Hunter - Destroy target creature with power 4 or greater. It can't be regenerated.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
