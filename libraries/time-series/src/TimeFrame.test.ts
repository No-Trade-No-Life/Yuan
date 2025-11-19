import { TimeFrame } from './TimeFrame';

describe('TimeFrame', () => {
  test('should create a TimeFrame with time series', () => {
    const tf = new TimeFrame();

    expect(tf.list).toHaveLength(1); // time series
    expect(tf.time.tags.id).toBe('time');
  });

  test('should create multiple time series', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });
    const volume = tf.createTimeSeries<number>({ id: 'volume' });

    expect(tf.list).toHaveLength(3); // time + price + volume
    expect(price.tags.id).toBe('price');
    expect(volume.tags.id).toBe('volume');
  });

  test('should handle data assignment and commit', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    // Assign data
    price[0] = 100;
    price[1] = 102;
    price[2] = 101;

    expect(price[0]).toBe(100);
    expect(price[1]).toBe(102);
    expect(price[2]).toBe(101);
    expect(price.cleanLength()).toBe(0); // Not committed yet

    tf.commit();

    expect(price.cleanLength()).toBe(3); // Committed
  });

  test('should handle pivot index correctly', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    price[0] = 100;
    price[1] = 102;
    tf.commit();

    expect(price.cleanLength()).toBe(2);

    // Modify existing data
    price[0] = 99; // This should reset pivot
    expect(price.cleanLength()).toBe(0);

    tf.commit();
    expect(price.cleanLength()).toBe(2);
  });

  test('should trigger calc on commit', () => {
    const tf = new TimeFrame();
    let calcCalled = false;

    const price = tf.createTimeSeries<number>({ id: 'price' }, () => {
      calcCalled = true;
    });

    price[0] = 100;
    expect(calcCalled).toBe(false);

    tf.commit();
    expect(calcCalled).toBe(true);
  });
});
