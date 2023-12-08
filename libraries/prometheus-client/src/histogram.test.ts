import { Histogram } from './histogram';

const buckets = [200, 400, 750, 1000];

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram(buckets);
  });

  it('observes some values', () => {
    histogram.observe(380);
    histogram.observe(400);
    histogram.observe(199);
    histogram.observe(1200);
    const result = histogram.collect();

    expect(result.length).toBe(1);
    expect(result[0].value).toMatchObject({
      sum: 2179,
      count: 4,
    });

    expect(result[0].value.entries).toEqual({
      200: 1,
      400: 3,
      750: 3,
      1000: 3,
      '+Inf': 4,
    });
  });

  it('clears observed values', () => {
    histogram.observe(380);
    histogram.observe(400);
    histogram.observe(199);
    histogram.reset();

    const result = histogram.collect();
    expect(result).toEqual([
      {
        labels: undefined,
        value: {
          sum: 0,
          count: 0,
          entries: {
            200: 0,
            400: 0,
            750: 0,
            1000: 0,
            '+Inf': 0,
          },
        },
      },
    ]);
    expect(result.length).toBe(1);
  });
});
