import { roundToStep } from './roundToStep';

describe('roundToStep', () => {
  it('roundToStep(0.5, 0.1) = 0.5', () => {
    expect(roundToStep(0.5, 0.1)).toBe(0.5);
  });
  it('roundToStep(0.55, 0.1) = 0.6', () => {
    expect(roundToStep(0.55, 0.1)).toBe(0.6);
  });
  it('roundToStep(3, 5) = 5', () => {
    expect(roundToStep(3, 5)).toBe(5);
  });
  it('roundToStep(0.6997, 1e-8, Math.floor) = 0.6997', () => {
    expect(roundToStep(0.6997, 1e-8, Math.floor)).toBe(0.6997);
  });
});
