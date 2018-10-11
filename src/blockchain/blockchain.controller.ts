import { Get, Controller, Param } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('v1')
export class BlockchainController {
  constructor(private readonly blockchain: BlockchainService) {}

  @Get('blockchains')
  async root() {
    return {
      supported: await this.blockchain.chains(),
    };
  }

  @Get(':blockchain')
  async state(@Param('blockchain') blockchain: string) {
    const db = await this.blockchain.getState(blockchain);
    return db;
  }

  @Get(':blockchain/address/:address/txs')
  async transactions(
    @Param('blockchain') blockchain: string,
    @Param('address') involved: string,
  ) {
    const txs = await this.blockchain.getTraces(blockchain, involved);
    console.log(txs);
    return {
      address: involved,
      blockchain,
      txs,
    };
  }
}
