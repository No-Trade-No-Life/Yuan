import { provideQueryProductsService } from '@yuants/data-product';
import { listProducts } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { listWatch, newError } from '@yuants/utils';
import { Observable, Subject } from 'rxjs';
import { validCredentialTypes$ } from './credential';

const terminal = Terminal.fromNodeEnv();

validCredentialTypes$
  .pipe(
    listWatch(
      (x) => x,
      (type) =>
        new Observable((sub) => {
          const dispose$ = new Subject<void>();
          sub.add(() => {
            dispose$.next();
            dispose$.complete();
          });
          provideQueryProductsService(
            terminal,
            type,
            async () => {
              const res = await listProducts(terminal, type);
              if (!res.data) throw newError('FETCH_PRODUCTS_FAILED', { credential: type, res });
              return res.data;
            },
            {
              auto_refresh_interval: 3600_000,
              dispose$,
            },
          );
        }),
    ),
  )
  .subscribe();
