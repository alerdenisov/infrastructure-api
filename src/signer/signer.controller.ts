import { Get, Controller } from '@nestjs/common';
import { SignerService } from './signer.service';

@Controller('signer')
export class SignerController {
  constructor(private readonly signer: SignerService) {}

  @Get()
  root(): string {
    return this.signer.root();
  }
}
