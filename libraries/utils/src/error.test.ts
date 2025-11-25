import { newError, scopeError } from './error';

describe('error', () => {
  describe('newError', () => {
    it('should create an error with formatted message', () => {
      const err = newError('TestError', { foo: 'bar', baz: 123 });
      expect(err.message).toBe('TestError: foo="bar", baz=123');
      expect(err.name).toBe('Error');
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { a: 1 };
      circular.b = circular;
      const err = newError('CircularError', { circular });
      expect(err.message).toContain('<SerializationError>');
    });

    it('should preserve original error as cause', () => {
      const original = new Error('Original');
      const err = newError('Wrapper', {}, original);
      // @ts-ignore
      expect(err.cause).toBe(original);
    });
  });

  describe('scopeError', () => {
    it('should return result for sync success', () => {
      const res = scopeError('Type', {}, () => 'success');
      expect(res).toBe('success');
    });

    it('should return result for async success', async () => {
      const res = await scopeError('Type', {}, async () => 'success');
      expect(res).toBe('success');
    });

    it('should wrap sync error', () => {
      expect(() => {
        scopeError('SyncError', { id: 1 }, () => {
          throw new Error('Fail');
        });
      }).toThrow('SyncError: id=1');
    });

    it('should wrap async error', async () => {
      await expect(
        scopeError('AsyncError', { id: 1 }, async () => {
          throw new Error('Fail');
        }),
      ).rejects.toThrow('AsyncError: id=1');
    });

    it('should support lazy context', () => {
      const contextFn = jest.fn(() => ({ id: 1 }));
      expect(() => {
        scopeError('LazyError', contextFn, () => {
          throw new Error('Fail');
        });
      }).toThrow('LazyError: id=1');
      expect(contextFn).toHaveBeenCalled();
    });

    it('should not evaluate lazy context on success', () => {
      const contextFn = jest.fn(() => ({ id: 1 }));
      scopeError('LazySuccess', contextFn, () => 'success');
      expect(contextFn).not.toHaveBeenCalled();
    });
  });
});
