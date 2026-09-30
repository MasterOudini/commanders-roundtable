// `Tormod, the Desecrator` - a cardLeavesYourGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TORMOD_THE_DESECRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TORMOD_THE_DESECRATOR, "Whenever one or more cards leave your graveyard, create a tapped 2/2 black Zombie creature token.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", TORMOD_THE_DESECRATOR.name);
const VOCAB_T_L0 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const TORMOD_THE_DESECRATOR_SCRIPT: CardScript = {
  oracleId: TORMOD_THE_DESECRATOR.oracleId,
  name: TORMOD_THE_DESECRATOR.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self)),
      label: () => "Tormod, the Desecrator - Create a tapped 2/2 black Zombie creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
