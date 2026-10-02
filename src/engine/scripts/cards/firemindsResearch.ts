// `Firemind's Research` - a castInstantSorcery trigger vocab, an activation draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIREMIND_S_RESEARCH } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(FIREMIND_S_RESEARCH, "Whenever you cast an instant or sorcery spell, put a charge counter on this enchantment.\n{1}{U}, Remove two charge counters from this enchantment: Draw a card.\n{1}{R}, Remove five charge counters from this enchantment: It deals 5 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a charge counter on this enchantment.", FIREMIND_S_RESEARCH.name);
const VOCAB_T_L0 = vocabularyTargets("Put a charge counter on this enchantment.");
const VOCAB_A1 = vocabularyEffects("It deals 5 damage to any target.", FIREMIND_S_RESEARCH.name);
const VOCAB_T_A1 = vocabularyTargets("It deals 5 damage to any target.");

export const FIREMINDS_RESEARCH_SCRIPT: CardScript = {
  oracleId: FIREMIND_S_RESEARCH.oracleId,
  name: FIREMIND_S_RESEARCH.name,
  activated: [
    {
      ref: `${FIREMIND_S_RESEARCH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${FIREMIND_S_RESEARCH.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Firemind's Research - Put a charge counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
