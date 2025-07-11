import { formatTime } from './format-time';

describe('formatTime', () => {
  it('should format a date with specified timezone', () => {
    const date = new Date('2022-01-01T00:00:00Z');
    expect(formatTime(date, 'America/New_York')).toEqual('2021-12-31 19:00:00.000-05:00');
  });

  it('should format a timestamp with specified timezone', () => {
    const timestamp = 1640995200000; // 2022-01-01T00:00:00Z
    expect(formatTime(timestamp, 'America/New_York')).toEqual('2021-12-31 19:00:00.000-05:00');
  });

  it('should return "Invalid Date" for an invalid date', () => {
    expect(formatTime('invalid date')).toEqual('Invalid Date');
  });
});
