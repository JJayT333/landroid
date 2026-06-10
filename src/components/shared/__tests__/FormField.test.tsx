import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FormField from '../FormField';

describe('FormField', () => {
  it('renders a datalist wired to the input when suggestions are provided', () => {
    const html = renderToStaticMarkup(
      <FormField
        label="Lessee"
        value=""
        onChange={() => {}}
        id="lessee-field"
        suggestions={['Apache Corp', 'COG Operating LLC']}
      />
    );

    expect(html).toContain('list="lessee-field-suggestions"');
    expect(html).toContain('<datalist id="lessee-field-suggestions">');
    expect(html).toContain('value="Apache Corp"');
    expect(html).toContain('value="COG Operating LLC"');
  });

  it('renders no datalist when suggestions are absent or empty', () => {
    for (const suggestions of [undefined, [] as string[]]) {
      const html = renderToStaticMarkup(
        <FormField
          label="Lessee"
          value=""
          onChange={() => {}}
          suggestions={suggestions}
        />
      );

      expect(html).not.toContain('datalist');
      expect(html).not.toContain('list=');
    }
  });
});
