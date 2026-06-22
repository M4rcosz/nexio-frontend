// [stub] backend does not implement /orders yet — always uses mock.
import type {
  CreateOrderRequest,
  Order,
  Paginated,
} from './types'
import {
  createOrderMock,
  getOrderMock,
  listMyOrdersMock,
  cancelOrderMock,
} from './mocks/orders'
import { MOCK_CUSTOMER } from './mocks/users'

export async function createOrder(body: CreateOrderRequest): Promise<Order> {
  return createOrderMock(MOCK_CUSTOMER.id, body)
}

export async function getOrder(id: string): Promise<Order | null> {
  return getOrderMock(id)
}

export async function listMyOrders(): Promise<Paginated<Order>> {
  return listMyOrdersMock(MOCK_CUSTOMER.id)
}

export async function cancelOrder(id: string): Promise<Order | null> {
  return cancelOrderMock(id)
}
