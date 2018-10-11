import { Module } from '@nestjs/common';
import { AppController } from './hello/app.controller';
import { AppService } from './hello/app.service';
import { SignerController } from './signer/signer.controller';
import { SignerService } from './signer/signer.service';
import { BlockchainController } from './blockchain/blockchain.controller';
import { BlockchainService } from './blockchain/blockchain.service';
import { waitFor } from 'utils';

@Module({
  imports: [],
  controllers: [AppController, SignerController, BlockchainController],
  providers: [
    AppService,
    SignerService,
    {
      provide: 'BlockchainService',
      useFactory: async () => {
        const bc = new BlockchainService();
        await waitFor(() => bc.ready);
        return bc;
      },
    },
  ],
})
export class AppModule {}
