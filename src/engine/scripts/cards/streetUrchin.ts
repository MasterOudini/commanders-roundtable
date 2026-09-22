// `Street Urchin` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STREET_URCHIN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(STREET_URCHIN, "Commander creatures you own have \"{1}, Sacrifice another creature or an artifact: This creature deals 1 damage to any target.\"");

const VOCAB_G0 = vocabularyEffects("~ deals 1 damage to any target.", STREET_URCHIN.name);
const VOCAB_T_G0 = vocabularyTargets("~ deals 1 damage to any target.");

const GRANT_0 = grantedActivated("{1}, Sacrifice another creature or an artifact: This creature deals 1 damage to any target.", `${STREET_URCHIN.oracleId}#g0`, STREET_URCHIN.name);

export const STREET_URCHIN_SCRIPT: CardScript = {
  oracleId: STREET_URCHIN.oracleId,
  name: STREET_URCHIN.name,
  activated: [
    {
      ref: GRANT_0.ref,
      text: PRINTED,
      granted: GRANT_0.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G0, VOCAB_T_G0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.players[ctx.query.controllerOf(self) ?? '']?.commanderIds ?? []).includes(candidate),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_0.ref, ability: GRANT_0.ability });
      },
    },
  ],
};
