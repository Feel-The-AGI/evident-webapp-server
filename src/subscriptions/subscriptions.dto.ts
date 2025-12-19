import { IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  successUrl: string;

  @IsString()
  cancelUrl: string;
}

export class WebhookEventDto {
  type: string;
  data: {
    object: any;
  };
}
