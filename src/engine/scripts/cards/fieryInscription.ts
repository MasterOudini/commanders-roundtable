// `Fiery Inscription` - a etb trigger vocab, a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIERY_INSCRIPTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIERY_INSCRIPTION, "When this enchantment enters, the Ring tempts you.\nWhenever you cast an instant or sorcery spell, this enchantment deals 2 damage to each opponent.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("The Ring tempts you.", FIERY_INSCRIPTION.name);
const VOCAB_T_L0 = vocabularyTargets("The Ring tempts you.");
const VOCAB_L1 = vocabularyEffects("This enchantment deals 2 damage to each opponent.", FIERY_INSCRIPTION.name);
const VOCAB_T_L1 = vocabularyTargets("This enchantment deals 2 damage to each opponent.");

export const FIERY_INSCRIPTION_SCRIPT: CardScript = {
  oracleId: FIERY_INSCRIPTION.oracleId,
  name: FIERY_INSCRIPTION.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Fiery Inscription - The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Fiery Inscription - This enchantment deals 2 damage to each opponent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
