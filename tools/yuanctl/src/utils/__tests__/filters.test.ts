import { buildWhereClause, mergeSelectors, parseFilterExpression } from '../../utils/filters';

describe('filters utilities', () => {
  it('parses selector expressions', () => {
    const filters = parseFilterExpression('package_name=@yuants/bot,address=abc');
    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({ field: 'package_name', value: '@yuants/bot' });
    expect(filters[1]).toEqual({ field: 'address', value: 'abc' });
  });

  it('builds SQL where clause', () => {
    const where = buildWhereClause({
      include: [
        { field: 'package_name', value: '@yuants/bot' },
        { field: 'enabled', value: 'true' },
      ],
    });
    expect(where).toContain("package_name = '@yuants/bot'");
    expect(where).toContain('enabled = true');
  });

  it('merges selectors from both syntaxes', () => {
    const merged = mergeSelectors({
      selector: 'package_name=@yuants/bot',
      fieldSelector: 'enabled=true',
    });
    expect(merged).toHaveLength(2);
  });
});
