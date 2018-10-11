import { Get, Controller, Param } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('v1')
export class BlockchainController {
  constructor(private readonly blockchain: BlockchainService) {}

  @Get(':blockchain')
  async root(@Param('blockchain') blockchain: string) {
    const db = await this.blockchain.getChain(blockchain);
    return db;
    // return this.blockchain.root();
  }
}
