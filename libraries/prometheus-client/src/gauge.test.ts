import { Gauge } from './gauge';

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge();
  });

  it('sets the gauge', () => {
    const value = 55;

    expect(gauge.set(value).get()!.value).toBe(value);
  });
  it('increments and decrements values', () => {
    expect(gauge.inc().get()!.value).toBe(1);
    expect(gauge.dec().get()!.value).toBe(0);

    gauge.inc({ label: 'foo' });
    gauge.dec({ label: 'foo' });
    expect(gauge.collect().length).toBe(2);
  });

  it('adds and subtracts from values', () => {
    const amount = 10;
    const amountSub = 5;

    expect(gauge.add(amount).get()!.value).toBe(amount);
    expect(gauge.sub(amountSub).get()!.value).toBe(amount - amountSub);

    gauge.add(amount, { label: 'foo' });
    gauge.sub(amountSub, { label: 'foo' });

    expect(gauge.collect().length).toBe(2);
  });
});
