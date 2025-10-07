import { useOrderBooks } from './utils';

interface Props {
  uniqueProductId: string;
}

export const OrderBook = (props: Props) => {
  const { uniqueProductId } = props;
  const books = useOrderBooks(uniqueProductId);

  //   if (!books) {
  //     return null;
  //   }

  return null;
};
