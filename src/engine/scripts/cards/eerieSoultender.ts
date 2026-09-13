// `Eerie Soultender` - a etb trigger mill, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EERIE_SOULTENDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EERIE_SOULTENDER, "When this creature enters, mill three cards. (Put the top three cards of your library into your graveyard.)\n{4}{B}, Exile this card from your graveyard: Return another target creature card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return another target creature card from your graveyard to your hand.", EERIE_SOULTENDER.name);
const VOCAB_T_A0 = vocabularyTargets("Return another target creature card from your graveyard to your hand.");

export const EERIE_SOULTENDER_SCRIPT: CardScript = {
  oracleId: EERIE_SOULTENDER.oracleId,
  name: EERIE_SOULTENDER.name,
  activated: [
    {
      ref: `${EERIE_SOULTENDER.oracleId}#a0`,
      text: LINES[1] as string,
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
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eerie Soultender - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 3));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};
