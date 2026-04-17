export interface GeoJsonFeatureSummary {
  id: string;
  label: string;
  geometryType: string;
}

export interface GeoJsonSummary {
  featureCount: number;
  features: GeoJsonFeatureSummary[];
  bbox: [number, number, number, number] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectPositions(value: unknown, positions: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    positions.push([value[0], value[1]]);
    return;
  }

  value.forEach((entry) => collectPositions(entry, positions));
}

function getFeatureLabel(feature: Record<string, unknown>, index: number): string {
  const properties = isRecord(feature.properties) ? feature.properties : {};
  for (const key of ['name', 'label', 'tract', 'lease', 'title']) {
    if (typeof properties[key] === 'string' && properties[key].trim()) {
      return properties[key].trim();
    }
  }
  if (typeof feature.id === 'string' && feature.id.trim()) {
    return feature.id.trim();
  }
  return `Feature ${index + 1}`;
}

export function parseGeoJsonSummary(text: string): GeoJsonSummary {
  const parsed = JSON.parse(text) as unknown;
  const features = isRecord(parsed) && Array.isArray(parsed.features)
    ? parsed.features
    : isRecord(parsed) && parsed.type === 'Feature'
      ? [parsed]
      : [];

  const positions: Array<[number, number]> = [];
  const summaries = features
    .filter((feature): feature is Record<string, unknown> => isRecord(feature))
    .map((feature, index) => {
      const geometry = isRecord(feature.geometry) ? feature.geometry : null;
      if (geometry) {
        collectPositions(geometry.coordinates, positions);
      }
      return {
        id: typeof feature.id === 'string' ? feature.id : `feature-${index + 1}`,
        label: getFeatureLabel(feature, index),
        geometryType:
          geometry && typeof geometry.type === 'string' ? geometry.type : 'Unknown',
      };
    });

  const bbox = positions.length > 0
    ? positions.reduce<[number, number, number, number]>(
        (bounds, [x, y]) => [
          Math.min(bounds[0], x),
          Math.min(bounds[1], y),
          Math.max(bounds[2], x),
          Math.max(bounds[3], y),
        ],
        [positions[0][0], positions[0][1], positions[0][0], positions[0][1]]
      )
    : null;

  return {
    featureCount: summaries.length,
    features: summaries,
    bbox,
  };
}
