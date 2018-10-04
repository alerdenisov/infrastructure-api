import { Injectable } from '@nestjs/common';

@Injectable()
export class SignerService {
  root(): string {
    return 'Hello World!';
  }
}
