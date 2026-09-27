// `Splashy Spellcaster` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPLASHY_SPELLCASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPLASHY_SPELLCASTER, "Whenever you cast an instant or sorcery spell, create a Sorcerer Role token attached to up to one other target creature you control. (If you control another Role on it, put that one into the graveyard. Enchanted creature gets +1/+1 and has \"Whenever this creature attacks, scry 1.\")");

const VOCAB_L0 = vocabularyEffects("Create a Sorcerer Role token attached to up to one other target creature you control.", SPLASHY_SPELLCASTER.name);
const VOCAB_T_L0 = vocabularyTargets("Create a Sorcerer Role token attached to up to one other target creature you control.");

export const SPLASHY_SPELLCASTER_SCRIPT: CardScript = {
  oracleId: SPLASHY_SPELLCASTER.oracleId,
  name: SPLASHY_SPELLCASTER.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Splashy Spellcaster - Create a Sorcerer Role token attached to up to one other target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
