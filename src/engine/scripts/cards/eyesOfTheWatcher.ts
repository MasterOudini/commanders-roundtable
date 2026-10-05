// `Eyes of the Watcher` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EYES_OF_THE_WATCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EYES_OF_THE_WATCHER, "Whenever you cast an instant or sorcery spell, you may pay {1}. If you do, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, scry 2.", EYES_OF_THE_WATCHER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, scry 2.");

export const EYES_OF_THE_WATCHER_SCRIPT: CardScript = {
  oracleId: EYES_OF_THE_WATCHER.oracleId,
  name: EYES_OF_THE_WATCHER.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Eyes of the Watcher - You may pay {1}. If you do, scry 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
