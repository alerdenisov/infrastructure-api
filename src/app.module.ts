import { Module } from '@nestjs/common';
import { AppController } from './hello/app.controller';
import { AppService } from './hello/app.service';
import { SignerController } from 'signer/signer.controller';
import { SignerService } from 'signer/signer.service';

@Module({
  imports: [],
  controllers: [AppController, SignerController],
  providers: [AppService, SignerService],
})
export class AppModule {}
