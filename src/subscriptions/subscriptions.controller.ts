import { Controller, Post, Get, Body, Req, UseGuards, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './subscriptions.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  private stripe: Stripe;

  constructor(
    private subscriptionsService: SubscriptionsService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionsService.createCheckoutSession(
      user.id,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortal(
    @CurrentUser() user: { id: string },
    @Body('returnUrl') returnUrl: string,
  ) {
    return this.subscriptionsService.createPortalSession(user.id, returnUrl);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: { id: string }) {
    return this.subscriptionsService.getSubscriptionStatus(user.id);
  }

  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody!, sig, webhookSecret!);
    } catch (err) {
      throw new Error(`Webhook signature verification failed`);
    }

    return this.subscriptionsService.handleWebhook(event);
  }
}
