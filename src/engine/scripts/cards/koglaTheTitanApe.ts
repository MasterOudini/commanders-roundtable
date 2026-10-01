// `Kogla, the Titan Ape` - a etb trigger vocab, a attacks trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOGLA_THE_TITAN_APE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOGLA_THE_TITAN_APE, "When Kogla enters, it fights up to one target creature you don't control.\nWhenever Kogla attacks, destroy target artifact or enchantment defending player controls.\n{1}{G}: Return target Human you control to its owner's hand. Kogla gains indestructible until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ fights up to one target creature you don't control.", KOGLA_THE_TITAN_APE.name);
const VOCAB_T_L0 = vocabularyTargets("~ fights up to one target creature you don't control.");
const VOCAB_L1 = vocabularyEffects("Destroy target artifact or enchantment defending player controls.", KOGLA_THE_TITAN_APE.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target artifact or enchantment defending player controls.");
const VOCAB_A0 = vocabularyEffects("Return target Human you control to its owner's hand. ~ gains indestructible until end of turn.", KOGLA_THE_TITAN_APE.name);
const VOCAB_T_A0 = vocabularyTargets("Return target Human you control to its owner's hand. ~ gains indestructible until end of turn.");

export const KOGLA_THE_TITAN_APE_SCRIPT: CardScript = {
  oracleId: KOGLA_THE_TITAN_APE.oracleId,
  name: KOGLA_THE_TITAN_APE.name,
  activated: [
    {
      ref: `${KOGLA_THE_TITAN_APE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
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
      label: () => "Kogla, the Titan Ape - ~ fights up to one target creature you don't control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Kogla, the Titan Ape - Destroy target artifact or enchantment defending player controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
