import { TimeFrame } from './TimeFrame';
import { combine } from './combine';
import { ITimeSeries } from './interfaces';

describe('combine', () => {
  test('should combine multiple series with mapping function', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });
    const volume = tf.createTimeSeries<number>({ id: 'volume' });

    // Add time data first
    tf.time[0] = 1000;
    tf.time[1] = 1001;
    tf.time[2] = 1002;

    // Add data
    price[0] = 100;
    price[1] = 102;
    price[2] = 101;
    volume[0] = 1000;
    volume[1] = 1200;
    volume[2] = 1100;

    // Create combined series
    const value = combine({ id: 'value' }, (index) => price[index] * volume[index], [price, volume]);

    tf.commit();

    expect(value[0]).toBe(100000); // 100 * 1000
    expect(value[1]).toBe(122400); // 102 * 1200
    expect(value[2]).toBe(111100); // 101 * 1100
  });

  test('should throw error when no sources provided', () => {
    const tf = new TimeFrame();

    expect(() => {
      combine({ id: 'test' }, (index) => index, []);
    }).toThrow('combine requires at least one source TimeSeries');
  });

  test('should throw error when sources belong to different timeframes', () => {
    const tf1 = new TimeFrame();
    const tf2 = new TimeFrame();
    const series1 = tf1.createTimeSeries<number>({ id: 'series1' });
    const series2 = tf2.createTimeSeries<number>({ id: 'series2' });

    expect(() => {
      combine({ id: 'test' }, (index) => index, [series1, series2]);
    }).toThrow('all source TimeSeries must belong to the same TimeFrame');
  });

  test('should handle incremental updates correctly', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });
    const volume = tf.createTimeSeries<number>({ id: 'volume' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;

    const value = combine({ id: 'value' }, (index) => price[index] * volume[index], [price, volume]);

    // Add initial data
    price[0] = 100;
    volume[0] = 1000;
    tf.commit();

    expect(value[0]).toBe(100000);

    // Add more data
    price[1] = 102;
    volume[1] = 1200;
    tf.commit();

    expect(value[1]).toBe(122400);
  });

  test('should use self reference in mapper function', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;
    tf.time[2] = 1002;

    price[0] = 100;
    price[1] = 102;
    price[2] = 101;

    // Create a series that references itself
    const cumulative = combine(
      { id: 'cumulative' },
      (index, self: ITimeSeries<number>) => (self[index - 1] ?? 0) + price[index],
      [price],
    );

    tf.commit();

    expect(cumulative[0]).toBe(100);
    expect(cumulative[1]).toBe(202); // 100 + 102
    expect(cumulative[2]).toBe(303); // 202 + 101
  });
});
