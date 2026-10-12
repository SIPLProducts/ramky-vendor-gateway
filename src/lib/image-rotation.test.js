import { describe, expect, test } from 'bun:test';
import { fitRotatedImage, rotateClockwise } from './image-rotation.ts';

describe('image preview rotation', () => {
  test('each click turns 90 degrees clockwise and four clicks restore orientation', () => {
    let angle = 0;
    for (const expected of [90,180,270,0]) {
      angle = rotateClockwise(angle);
      expect(angle).toBe(expected);
    }
  });
  test('portrait images fit after a quarter turn', () => {
    expect(fitRotatedImage(600,1200,800,400,90)).toEqual({ width: 400, height: 800 });
    expect(fitRotatedImage(600,1200,800,400,0)).toEqual({ width: 200, height: 400 });
  });
  test('landscape images fit after a quarter turn', () => {
    expect(fitRotatedImage(1200,600,800,400,90)).toEqual({ width: 400, height: 200 });
  });
});