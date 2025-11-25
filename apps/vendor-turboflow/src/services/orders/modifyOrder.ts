import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { ICredential, remendOrder } from '../../api/private-api';

export const modifyOrder = async (credential: ICredential, order: IOrder): Promise<void> => {
  console.info(`[${formatTime(Date.now())}] Modifying order ${order.order_id}`);

  try {
    // Parse comment for position_id and other parameters
    let position_id: string | undefined;
    let tp_order: any;
    let sl_order: any;

    if (order.comment) {
      try {
        const params = JSON.parse(order.comment);
        position_id = params.position_id;
        tp_order = params.tp_order;
        sl_order = params.sl_order;
      } catch (e) {
        console.warn(`[${formatTime(Date.now())}] Failed to parse order comment:`, e);
      }
    }

    if (!position_id) {
      throw new Error('position_id is required for modifying order');
    }

    const response = await remendOrder(credential, {
      position_id,
      price: order.price?.toString(),
      vol: order.volume.toString(),
      tp_order,
      sl_order,
    });

    if (response.errno !== '0') {
      throw new Error(`Failed to modify order: ${response.msg}`);
    }

    console.info(`[${formatTime(Date.now())}] Order modified successfully`);
  } catch (error) {
    console.error(`[${formatTime(Date.now())}] Error modifying order:`, error);
    throw error;
  }
};
