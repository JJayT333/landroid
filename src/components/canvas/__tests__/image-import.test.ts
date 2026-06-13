import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_DISPLAY,
  initialImageDisplaySize,
  isImageFile,
} from '../image-import';

describe('image-import', () => {
  it('caps the initial display size to the default longest edge, preserving aspect', () => {
    const size = initialImageDisplaySize(3200, 1600); // 2:1, oversized
    expect(Math.max(size.width, size.height)).toBe(DEFAULT_IMAGE_DISPLAY);
    expect(size.width / size.height).toBeCloseTo(2, 5);
  });

  it('leaves small images at natural size', () => {
    const size = initialImageDisplaySize(120, 80);
    expect(size).toEqual({ width: 120, height: 80 });
  });

  it('recognizes image blobs by mime', () => {
    expect(isImageFile(new Blob([], { type: 'image/png' }))).toBe(true);
    expect(isImageFile(new Blob([], { type: 'application/pdf' }))).toBe(false);
  });
});
