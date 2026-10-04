// `Boggart Trawler // Boggart Bog` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOGGART_TRAWLER_BOGGART_BOG } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BOGGART_TRAWLER_BOGGART_BOG, "When this creature enters, exile target player's graveyard.\nAs this land enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {B}.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target player's graveyard.", BOGGART_TRAWLER_BOGGART_BOG.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target player's graveyard.");

export const BOGGART_TRAWLER_BOGGART_BOG_SCRIPT: CardScript = {
  oracleId: BOGGART_TRAWLER_BOGGART_BOG.oracleId,
  name: BOGGART_TRAWLER_BOGGART_BOG.name,
  triggers: [
    {
      abilityId: 'etb-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Boggart Trawler // Boggart Bog - Exile target player's graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
