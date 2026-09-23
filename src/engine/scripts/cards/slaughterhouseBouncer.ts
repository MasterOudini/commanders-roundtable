// `Slaughterhouse Bouncer` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLAUGHTERHOUSE_BOUNCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLAUGHTERHOUSE_BOUNCER, "Hellbent — When this creature dies, if you have no cards in hand, target creature gets -3/-3 until end of turn.");

const VOCAB_L0 = vocabularyEffects("If you have no cards in hand, target creature gets -3/-3 until end of turn.", SLAUGHTERHOUSE_BOUNCER.name);
const VOCAB_T_L0 = vocabularyTargets("If you have no cards in hand, target creature gets -3/-3 until end of turn.");

export const SLAUGHTERHOUSE_BOUNCER_SCRIPT: CardScript = {
  oracleId: SLAUGHTERHOUSE_BOUNCER.oracleId,
  name: SLAUGHTERHOUSE_BOUNCER.name,
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
      label: () => "Slaughterhouse Bouncer - If you have no cards in hand, target creature gets -3/-3 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
