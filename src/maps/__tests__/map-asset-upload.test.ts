import { describe, expect, it } from 'vitest';
import { PDF_MIME_TYPE } from '../../utils/pdf-validation';
import { prepareMapAssetUploadFile } from '../map-asset-upload';

function makeFile(
  bytes: string,
  name: string,
  type = ''
): File {
  return new File([bytes], name, { type });
}

describe('prepareMapAssetUploadFile', () => {
  it('normalizes PDF uploads after magic-byte validation', async () => {
    const file = makeFile('%PDF-1.7\nmap', 'survey-map.pdf', 'text/plain');

    const prepared = await prepareMapAssetUploadFile(file);

    expect(prepared.fileName).toBe('survey-map.pdf');
    expect(prepared.mimeType).toBe(PDF_MIME_TYPE);
    expect(prepared.blob.type).toBe(PDF_MIME_TYPE);
  });

  it('rejects fake PDFs before they can be saved as map assets', async () => {
    const file = makeFile('not a pdf', 'survey-map.pdf', 'application/pdf');

    await expect(prepareMapAssetUploadFile(file)).rejects.toThrow(
      /valid PDF file/
    );
  });

  it('rejects active-content extensions even when the browser reports an image type', async () => {
    const file = makeFile('<svg></svg>', 'unit-map.svg', 'image/svg+xml');

    await expect(prepareMapAssetUploadFile(file)).rejects.toThrow(
      /not supported/i
    );
  });

  it('accepts GeoJSON reference artifacts without PDF normalization', async () => {
    const file = makeFile('{"type":"FeatureCollection","features":[]}', 'tract.geojson', 'application/geo+json');

    const prepared = await prepareMapAssetUploadFile(file);

    expect(prepared.fileName).toBe('tract.geojson');
    expect(prepared.mimeType).toBe('application/geo+json');
    expect(prepared.blob).toBe(file);
  });
});
