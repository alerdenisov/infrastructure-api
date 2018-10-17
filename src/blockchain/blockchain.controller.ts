import { Get, Controller, Param, Query } from '@nestjs/common';
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

  @Get(':blockchain/blocks')
  async blocks(
    @Query()
    query: {
      filled?: string;
      trx?: string;
    },
    @Param('blockchain') blockchain: string,
  ) {
    const blocks = await this.blockchain.getBlocks(
      blockchain,
      typeof query.filled !== 'undefined',
      typeof query.trx !== 'undefined',
    );
    return {
      query,
      filled: typeof query.filled !== 'undefined',
      trx: typeof query.trx !== 'undefined',
      blockchain,
      blocks,
    };
  }

  @Get(':blockchain/block/:heightOrHash')
  async block(
    @Query()
    query: {
      filled?: string;
      trx?: string;
    },
    @Param('heightOrHash') heightOrHash: string,
  ) {
    if (heightOrHash.match(/^\d+$/)) {
      const height = parseInt(heightOrHash, 10)
    }
    // const blocks = await this.blockchain.getBlocks(
    //   blockchain,
    //   typeof query.filled !== 'undefined',
    //   typeof query.trx !== 'undefined',
    // );
    // return {
    //   query,
    //   filled: typeof query.filled !== 'undefined',
    //   trx: typeof query.trx !== 'undefined',
    //   blockchain,
    //   blocks,
    // };
  }

  @Get(':blockchain/address/:address/txs')
  async transactions(
    @Param('blockchain') blockchain: string,
    @Param('address') involved: string,
  ) {
    const txs = await this.blockchain.getTraces(blockchain, involved);
    return {
      address: involved,
      blockchain,
      txs,
    };
  }
}
