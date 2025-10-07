import React from 'react';
import { useOrderBooks } from './utils';
import { OrderBookComponent } from './components/OrderBookComponent';

interface Props {
  uniqueProductId: string;
}

export const OrderBook = React.memo((props: Props) => {
  const { uniqueProductId } = props;
  const books = useOrderBooks(uniqueProductId);

  //   console.log({ books, uniqueProductId });
  //   if (!books) {
  //     return null;
  //   }

  return <OrderBookComponent uniqueProductId={uniqueProductId} />;
});
