// `Haunted Hellride` - a youAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAUNTED_HELLRIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAUNTED_HELLRIDE, "Whenever you attack, target creature you control gets +1/+0 and gains deathtouch until end of turn. Untap it.\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature you control gets +1/+0 and gains deathtouch until end of turn. Untap it.", HAUNTED_HELLRIDE.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control gets +1/+0 and gains deathtouch until end of turn. Untap it.");

export const HAUNTED_HELLRIDE_SCRIPT: CardScript = {
  oracleId: HAUNTED_HELLRIDE.oracleId,
  name: HAUNTED_HELLRIDE.name,
  triggers: [
    {
      abilityId: 'youAttack-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Haunted Hellride - Target creature you control gets +1/+0 and gains deathtouch until end of turn. Untap it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
