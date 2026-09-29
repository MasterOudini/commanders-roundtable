// `Exhumer Thrull` - a etb trigger vocab, a hauntedDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXHUMER_THRULL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXHUMER_THRULL, "Haunt (When this creature dies, exile it haunting target creature.)\nWhen this creature enters or the creature it haunts dies, return target creature card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature card from your graveyard to your hand.", EXHUMER_THRULL.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const EXHUMER_THRULL_SCRIPT: CardScript = {
  oracleId: EXHUMER_THRULL.oracleId,
  name: EXHUMER_THRULL.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Exhumer Thrull - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'hauntedDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ["exile"],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (ctx, self, ev) => hauntedDied(ctx, self, ev),
      label: () => "Exhumer Thrull - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
