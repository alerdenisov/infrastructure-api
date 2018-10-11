#! /bin/bash

rm -rf data/eos/mnt
rm -rf data/eos/mongo
rm -rf data/parity/cache
rm -rf data/parity/chains
rm -rf data/parity/dapps
rm -rf data/parity/network
rm -rf data/parity/signer
rm -rf data/parity/jsonrpc.json
rm -rf data/rethinkdb

docker-compose rm -v -f
docker-compose up