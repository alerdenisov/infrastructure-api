#! /bin/bash
docker-compose down
docker-compose rm -v -f

rm -rf data/eos/mnt
rm -rf data/eos/mongo
rm -rf data/parity/cache
rm -rf data/parity/chains
rm -rf data/parity/dapps
rm -rf data/parity/network
rm -rf data/parity/signer
rm -rf data/parity/jsonrpc.json
rm -rf data/rethinkdb

docker-compose up -d rethinkdb 

yarn start -- eth setup
yarn start:dev eth blk &
yarn start:dev eth trx &
yarn start:dev eth pen &
yarn start:dev eth trc &
yarn start:dev eth rec &
yarn start:dev eth par
