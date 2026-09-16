// `Iconic Shield` - a static attachedStatic, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICONIC_SHIELD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(ICONIC_SHIELD, "Equipped creature gets +1/+2 and has \"Whenever this creature attacks, another target attacking creature gains indestructible until end of turn.\" (Damage and effects that say \"destroy\" don't destroy it.)\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Another target attacking creature gains indestructible until end of turn.", ICONIC_SHIELD.name);
const VOCAB_T_L0 = vocabularyTargets("Another target attacking creature gains indestructible until end of turn.");

const GRANT_0 = grantedTriggerRef(`${ICONIC_SHIELD.oracleId}#gt0`, ICONIC_SHIELD.name);

export const ICONIC_SHIELD_SCRIPT: CardScript = {
  oracleId: ICONIC_SHIELD.oracleId,
  name: ICONIC_SHIELD.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Iconic Shield - Another target attacking creature gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
