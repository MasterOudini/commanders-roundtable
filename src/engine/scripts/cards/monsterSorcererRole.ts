// `Monster // Sorcerer` - a double-faced ROLE token printing (D574, CR 303.7): one Aura token is one face of it, the face
// the Role table named when the token was created (`TokenCreated.faceIndex`). Every static and the granted trigger reads
// the token's face, so one script runs both Roles: Monster (+1/+1 and trample) and Sorcerer (+1/+1 and "Whenever this
// creature attacks, scry 1." - D368's granted-trigger carrier; the RECIPIENT is the trigger's source).

import { MONSTER_SORCERER_ROLE_TOKEN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

const MONSTER = 'Enchanted creature gets +1/+1 and has trample.';
const SORCERER = 'Enchanted creature gets +1/+1 and has "Whenever this creature attacks, scry 1."';

function printed(card: CardData, expected: readonly (readonly string[])[]): void {
  expected.forEach((lines, i) => {
    const actual = (card.faces[i]?.oracleText ?? '').split(String.fromCharCode(10));
    if (actual.join('|') !== lines.join('|')) {
      throw new Error(`${card.name} face ${i} reads "${actual.join(' / ')}" and its script was written for "${lines.join(' / ')}". Re-read the card before re-registering it (D90).`);
    }
  });
}
printed(MONSTER_SORCERER_ROLE_TOKEN, [['Enchant creature', MONSTER], ['Enchant creature', SORCERER]]);

/** The Role's host, when this token is the face `face` of its printing. */
function hostOf(ctx: ScriptCtx, self: InstanceId, face: number): InstanceId | null {
  const me = ctx.state.cards[self];
  return me && (me.faceIndex ?? 0) === face ? me.attachedTo : null;
}

const REF = grantedTriggerRef(`${MONSTER_SORCERER_ROLE_TOKEN.oracleId}#gt1`, MONSTER_SORCERER_ROLE_TOKEN.name);
const SCRY = vocabularyEffects('Scry 1.', MONSTER_SORCERER_ROLE_TOKEN.name);
const SCRY_T = vocabularyTargets('Scry 1.');

export const MONSTER_SORCERER_ROLE_SCRIPT: CardScript = {
  oracleId: MONSTER_SORCERER_ROLE_TOKEN.oracleId,
  name: MONSTER_SORCERER_ROLE_TOKEN.name,
  statics: [
    {
      abilityId: 'monster-pt',
      text: MONSTER,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'monster-kw',
      text: MONSTER,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        chars.keywords.add('trample');
      },
    },
    {
      abilityId: 'sorcerer-pt',
      text: SORCERER,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 1) === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'sorcerer-grant',
      text: SORCERER,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 1) === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: REF });
      },
    },
  ],
  triggers: [
    {
      // ⚠️ The abilityId MUST start with `gt`: that marker is how the registry indexes this def as GRANTED (D368).
      abilityId: 'gt1',
      text: SORCERER,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Sorcerer Role - scry 1',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, SCRY, SCRY_T),
    },
  ],
};
