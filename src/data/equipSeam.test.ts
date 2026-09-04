// D305 - THE EQUIPMENT SEAM, the parser, accounting and classifier half: "Equip
// {N}" is a synthesized activated ability (sorcery-speed, one target, a mana
// cost), the accounting and the disclosure no longer hold the line against the
// card, the classifier files it as scriptable, and the equipped-creature shapes.

import { describe, expect, test } from 'vitest';
import { LIGHTNING_GREAVES } from './fixtures/engineCards';
import { parseActivatedAbilities } from './activatedParse';
import { engineCompleteness } from './engineComplete';
import { parseManaCost } from './oracleParse';
import { equipLineRuns, equipLineShape, primitiveFor } from './primitives';
import { tier3NotesFor } from './tier3';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('the Equipment seam (D305)', () => {
  test('Equip {N} is a synthesized activated ability: sorcery-speed, one creature you control, a mana cost', () => {
    const abilities = parse('Equipped creature gets +2/+2.\nEquip {2} (Equip only as a sorcery.)');
    expect(abilities).toHaveLength(1);
    const equip = abilities[0];
    expect(equip?.equip?.line).toBe('Equip {2}');
    expect(equip?.sorceryOnly).toBe(true);
    expect(equip?.payable).toBe(true);
    expect(equip?.isManaAbility).toBe(false);
    expect(equip?.targets).toHaveLength(1);
    expect(equip?.targets[0]?.kinds).toEqual(['creature']);
    expect(equip?.targets[0]?.controller).toBe('you');
  });

  test('the reminder text, colon and all, does not turn it into an unpayable activated ability', () => {
    const abilities = parse('Equipped creature gets +0/+3 and has vigilance.\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)');
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.equip?.line).toBe('Equip {3}');
    expect(abilities[0]?.costText).toBe('{3}');
    expect(abilities[0]?.payable).toBe(true);
  });

  test('it takes its index where the card prints it, after a colon ability above it', () => {
    const abilities = parse('{T}: Add {C}.\nEquip {1}');
    expect(abilities).toHaveLength(2);
    expect(abilities[1]?.equip?.line).toBe('Equip {1}');
    expect(abilities[1]?.index).toBe(1);
  });

  test('a typed equip, a non-mana equip cost and Reconfigure are not synthesized', () => {
    expect(parse('Equip Knight {1}')).toHaveLength(0);
    expect(parse('Equip—Sacrifice a creature.')).toHaveLength(0);
    expect(parse('Reconfigure {2}')).toHaveLength(0);
  });

  test('the accounting and the disclosure no longer hold the Equip line against Lightning Greaves', () => {
    expect(engineCompleteness(LIGHTNING_GREAVES).leftover).not.toContain('Equip {0}');
    expect(tier3NotesFor(LIGHTNING_GREAVES).map((n) => n.what)).not.toContain('Equip');
  });

  test('the classifier files a mana Equip as scriptable and the rest as keyword:equip', () => {
    expect(equipLineRuns('Equip {3}')).toBe(true);
    expect(equipLineRuns('Equip {1}{W}')).toBe(true);
    expect(equipLineRuns('Equip Knight {1}')).toBe(false);
    expect(equipLineRuns('Equip—Pay 2 life.')).toBe(false);
    expect(primitiveFor({ text: 'Equip {2}', kind: 'sentence' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Equip Knight {1}', kind: 'sentence' }, 'X')).toBe('keyword:equip');
  });

  test('the equipped-creature shapes a row can emit', () => {
    expect(equipLineShape('Equipped creature gets +2/+2.')).toBe(true);
    expect(equipLineShape('Equipped creature gets +1/+0 and has first strike.')).toBe(true);
    expect(equipLineShape('Equipped creature has haste and shroud.')).toBe(true);
    expect(equipLineShape("Equipped creature can't block.")).toBe(true);
    expect(equipLineShape("Equipped creature can't be blocked.")).toBe(true);
    expect(equipLineShape('Equipped creature gets +1/+1 for each artifact you control.')).toBe(false);
    expect(equipLineShape('Equipped creature has "{T}: Add {G}."')).toBe(false);
    expect(equipLineShape("Equipped creature can't be blocked by creatures with flying.")).toBe(false);
  });
});
