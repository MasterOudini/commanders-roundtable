// `Nymris, Oona's Trickster` - a castInOpponentsTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NYMRIS_OONA_S_TRICKSTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NYMRIS_OONA_S_TRICKSTER, "Flash\nFlying\nWhenever you cast your first spell during each opponent's turn, look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.", NYMRIS_OONA_S_TRICKSTER.name);
const VOCAB_T_L2 = vocabularyTargets("Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.");

export const NYMRIS_OONAS_TRICKSTER_SCRIPT: CardScript = {
  oracleId: NYMRIS_OONA_S_TRICKSTER.oracleId,
  name: NYMRIS_OONA_S_TRICKSTER.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 1,
      label: () => "Nymris, Oona's Trickster - Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
