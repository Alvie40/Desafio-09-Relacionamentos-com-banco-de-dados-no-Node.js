import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);
    if (!findCustomer) {
      throw new AppError('This customer does not exist.');
    }

    const orderedProducts: {
      product_id: string;
      price: number;
      quantity: number;
    }[] = [];

    const productsFromDB = await this.productsRepository.findAllById(products);

    const productsToUpdate = products.map(productToUpdate => {
      const findProduct = productsFromDB.find(
        product => product.id === productToUpdate.id,
      );

      if (!findProduct) {
        throw new AppError(`The product ${productToUpdate.id} does not exist.`);
      }
      if (findProduct.quantity < productToUpdate.quantity) {
        throw new AppError(
          `Quantity of the product ${productToUpdate.id} is insufficient.`,
        );
      }

      findProduct.quantity -= productToUpdate.quantity;

      const orderedProduct = {
        product_id: findProduct.id,
        price: findProduct.price,
        quantity: productToUpdate.quantity,
      };

      orderedProducts.push(orderedProduct);

      return {
        id: findProduct.id,
        price: findProduct.price,
        quantity: findProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdate);

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: orderedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
