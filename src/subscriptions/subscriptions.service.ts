import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = this.configService.get('STRIPE_PRICE_ID');
    
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });

    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(userId: string, returnUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new Error('No subscription found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: 'ACTIVE' },
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        await this.prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: 'CANCELLED' },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await this.prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: 'EXPIRED' },
        });
        break;
      }
    }
    return { received: true };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        trialExportUsed: true,
        exportCount: true,
      },
    });
    return user;
  }
}
