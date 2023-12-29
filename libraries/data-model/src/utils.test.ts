import { decodePath, encodePath, formatTime } from './utils';

describe('decodePath', () => {
  it('should split a path by `/`', () => {
    expect(decodePath('foo/bar/baz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('should handle escaped `/` in a param', () => {
    expect(decodePath('foo/bar\\/baz')).toEqual(['foo', 'bar/baz']);
  });

  it('should handle multiple escaped `/` in a param', () => {
    expect(decodePath('foo/bar\\/baz\\/qux')).toEqual(['foo', 'bar/baz/qux']);
  });

  it('should handle escaped `/` at the beginning of a param', () => {
    expect(decodePath('foo/\\/bar/baz')).toEqual(['foo', '/bar', 'baz']);
  });

  it('should handle escaped `/` at the end of a param', () => {
    expect(decodePath('foo/bar/baz\\/')).toEqual(['foo', 'bar', 'baz/']);
  });

  it('should handle escaped `/` at the beginning and end of a param', () => {
    expect(decodePath('foo/\\/bar\\/baz\\/')).toEqual(['foo', '/bar/baz/']);
  });
});

describe('encodePath', () => {
  it('should return an empty string for no input', () => {
    expect(encodePath()).toEqual('');
  });

  it('should join multiple params with `/`', () => {
    expect(encodePath('foo', 'bar', 'baz')).toEqual('foo/bar/baz');
  });

  it('should escape `/` in a param', () => {
    expect(encodePath('foo/bar', 'baz')).toEqual('foo\\/bar/baz');
  });

  it('should escape multiple `/` in a param', () => {
    expect(encodePath('foo/bar/baz', 'qux')).toEqual('foo\\/bar\\/baz/qux');
  });

  it('should escape `/` at the beginning of a param', () => {
    expect(encodePath('/foo', 'bar', 'baz')).toEqual('\\/foo/bar/baz');
  });

  it('should escape `/` at the end of a param', () => {
    expect(encodePath('foo', 'bar', 'baz/')).toEqual('foo/bar/baz\\/');
  });

  it('should escape `/` at the beginning and end of a param', () => {
    expect(encodePath('/foo', 'bar/baz/')).toEqual('\\/foo/bar\\/baz\\/');
  });
});

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
