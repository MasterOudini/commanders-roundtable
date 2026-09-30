// `Hidden Footblade` - a etb trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIDDEN_FOOTBLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIDDEN_FOOTBLADE, "Flash\nWhen this Equipment enters, attach it to target creature you control. That creature gains first strike until end of turn.\nEquipped creature gets +1/+0 and has haste.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Attach ~ to target creature you control. That creature gains first strike until end of turn.", HIDDEN_FOOTBLADE.name);
const VOCAB_T_L1 = vocabularyTargets("Attach ~ to target creature you control. That creature gains first strike until end of turn.");

export const HIDDEN_FOOTBLADE_SCRIPT: CardScript = {
  oracleId: HIDDEN_FOOTBLADE.oracleId,
  name: HIDDEN_FOOTBLADE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hidden Footblade - Attach ~ to target creature you control. That creature gains first strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
