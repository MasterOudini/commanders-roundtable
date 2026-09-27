// `Royal // Young Hero` - a double-faced ROLE token printing (D575, CR 303.7): one Aura token is one face of it (the face
// the Role table named - `TokenCreated.faceIndex`). Royal: +1/+1 and a GRANTED ward {1} (D575's derived ward - the host's
// tax reads the derive, the client's the view). Young Hero: "Whenever this creature attacks, if its toughness is 3 or less,
// put a +1/+1 counter on it." - D368's granted trigger, the intervening if checked as it triggers and again as it resolves
// (CR 603.4); the RECIPIENT is the trigger's source.

import { ROYAL_YOUNG_HERO_ROLE_TOKEN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';
import type { WardCharge } from '../../types/oracle';

const ROYAL = 'Enchanted creature gets +1/+1 and has ward {1}. (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {1}.)';
const YOUNG_HERO = 'Enchanted creature has "Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it."';

function printed(card: CardData, expected: readonly (readonly string[])[]): void {
  expected.forEach((lines, i) => {
    const actual = (card.faces[i]?.oracleText ?? '').split(String.fromCharCode(10));
    if (actual.join('|') !== lines.join('|')) {
      throw new Error(`${card.name} face ${i} reads "${actual.join(' / ')}" and its script was written for "${lines.join(' / ')}". Re-read the card before re-registering it (D90).`);
    }
  });
}
printed(ROYAL_YOUNG_HERO_ROLE_TOKEN, [['Enchant creature', ROYAL], ['Enchant creature', YOUNG_HERO]]);

/** The Role's host, when this token is the face `face` of its printing. */
function hostOf(ctx: ScriptCtx, self: InstanceId, face: number): InstanceId | null {
  const me = ctx.state.cards[self];
  return me && (me.faceIndex ?? 0) === face ? me.attachedTo : null;
}

/** Royal's ward {1} (CR 702.21). */
const WARD_ONE: WardCharge = {
  wardCost: { generic: 1, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 1, raw: '{1}' },
  wardLife: 0,
};

const REF = grantedTriggerRef(`${ROYAL_YOUNG_HERO_ROLE_TOKEN.oracleId}#gt1`, ROYAL_YOUNG_HERO_ROLE_TOKEN.name);
const COUNTER = vocabularyEffects('put a +1/+1 counter on it.', ROYAL_YOUNG_HERO_ROLE_TOKEN.name);
const COUNTER_T = vocabularyTargets('put a +1/+1 counter on it.');
/** The intervening if: its toughness is 3 or less. */
const small = (ctx: ScriptCtx, id: InstanceId): boolean => {
  const t = ctx.derive(id).toughness;
  return t !== null && t <= 3;
};

export const ROYAL_YOUNG_HERO_ROLE_SCRIPT: CardScript = {
  oracleId: ROYAL_YOUNG_HERO_ROLE_TOKEN.oracleId,
  name: ROYAL_YOUNG_HERO_ROLE_TOKEN.name,
  statics: [
    {
      abilityId: 'royal-pt',
      text: ROYAL,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'royal-ward',
      text: ROYAL,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        chars.wards.push(WARD_ONE);
      },
    },
    {
      abilityId: 'young-hero-grant',
      text: YOUNG_HERO,
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
      text: YOUNG_HERO,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && small(ctx, self),
      label: () => 'Young Hero Role - a +1/+1 counter',
      // CR 603.4 - the intervening if again as it resolves: a creature grown past 3 toughness gets nothing.
      resolve: (ctx, self, obj) => (small(ctx, self) ? ctx.vocabulary(obj, COUNTER, COUNTER_T) : []),
    },
  ],
};
