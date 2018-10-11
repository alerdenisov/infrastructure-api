#!/usr/bin/env bash
set -o errexit

echo "=== setup blockchain accounts and smart contract ==="

# set PATH
PATH="$PATH:/opt/eosio/bin:/opt/eosio/bin/scripts"


set -m
echo "=== wait for mongo (TODO: healthcheck) ==="
sleep 15s

# start nodeos ( local node of blockchain )
# run it in a background job such that docker run could continue
nodeos -e -p eosio -d /mnt/dev/data \
  --config-dir /mnt/dev/config \
  --http-validate-host=false \
  --plugin eosio::producer_plugin \
  --plugin eosio::history_plugin \
  --plugin eosio::chain_api_plugin \
  --plugin eosio::history_api_plugin \
  --plugin eosio::history_api_plugin \
  --plugin eosio::http_plugin \
  --plugin eosio::mongo_db_plugin \
  --http-server-address=0.0.0.0:8888 \
  --access-control-allow-origin=* \
  --mongodb-uri=mongodb://mongodb \
  --contracts-console \
  --max-transaction-time=1000 \
  --verbose-http-errors &
sleep 1s
  until curl localhost:8888/v1/chain/get_info
do
  sleep 1s
done

# Sleep for 2 to allow time 4 blocks to be created so we have blocks to reference when sending transactions
sleep 2s
echo "=== setup wallet: eosiomain ==="
# First key import is for eosio system account
cleos wallet create -n eosiomain --to-console | tail -1 | sed -e 's/^"//' -e 's/"$//' > eosiomain_wallet_password.txt
cleos wallet import -n eosiomain --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3

echo "=== setup wallet: blogwallet ==="
# key for eosio account and export the generated password to a file for unlocking wallet later
cleos wallet create -n blogwallet --to-console | tail -1 | sed -e 's/^"//' -e 's/"$//' > blog_wallet_password.txt
# Owner key for blogwallet wallet
cleos wallet import -n blogwallet --private-key 5JpWT4ehouB2FF9aCfdfnZ5AwbQbTtHBAwebRXt94FmjyhXwL4K
# Active key for blogwallet wallet
cleos wallet import -n blogwallet --private-key 5JD9AGTuTeD5BXZwGQ5AtwBqHK21aHmYnTetHgk1B3pjj7krT8N

# * Replace "blogwallet" with your own wallet name when you start your own project

# create account for blogaccount with above wallet's public keys
cleos create account eosio blogaccount EOS6PUh9rs7eddJNzqgqDx1QrspSHLRxLMcRdwHZZRL4tpbtvia5B EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9
cleos create account eosio masteroracle EOS6PUh9rs7eddJNzqgqDx1QrspSHLRxLMcRdwHZZRL4tpbtvia5B EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9
cleos create account eosio priceoracliz EOS6PUh9rs7eddJNzqgqDx1QrspSHLRxLMcRdwHZZRL4tpbtvia5B EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9
cleos create account eosio ducororacle1 EOS6PUh9rs7eddJNzqgqDx1QrspSHLRxLMcRdwHZZRL4tpbtvia5B EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9

# * Replace "blogaccount" with your own account name when you start your own project

echo "=== deploy smart contract ==="
# $1 smart contract name 
# $2 account holder name of the smart contract
# $3 wallet that holds the keys for the account
# $4 password for unlocking the wallet
echo "=== blog ==="
deploy_contract.sh blog blogaccount blogwallet $(cat blog_wallet_password.txt)
echo "=== oracles ==="
deploy_contract.sh masteroracle masteroracle blogwallet $(cat blog_wallet_password.txt)
deploy_contract.sh priceoraclize priceoracliz blogwallet $(cat blog_wallet_password.txt)

echo "=== setup oraclize ==="
echo "=== updateauth of masteroracle ==="
cleos push action eosio updateauth '{"account":"masteroracle","permission":"active","parent":"owner","auth":{"threshold":1,"keys": [{"key":"EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9","weight":1}],"accounts": [{"permission": {"actor":"masteroracle","permission":"eosio.code"},"weight":1}],"waits":[]}}' -p masteroracle@active
echo "=== updateauth of priceoracliz ==="
cleos push action eosio updateauth '{"account":"priceoracliz","permission":"active","parent":"owner","auth":{"threshold":1,"keys": [{"key":"EOS8BCgapgYA2L4LJfCzekzeSr3rzgSTUXRXwNi8bNRoz31D14en9","weight":1}],"accounts": [{"permission": {"actor":"priceoracliz","permission":"eosio.code"},"weight":1}],"waits":[]}}' -p priceoracliz@active
# cleos push action blogaccount createpost "[ $timestamp, "\""bobross"\"", "\""$title"\"", "\""$content"\"", "\""$tag"\""]" -p bobross@active
echo "=== setup of priceoracliz ==="
cleos push action priceoracliz setup '["masteroracle"]' -p priceoracliz@active --json
echo "=== addoracle to masteroracle ==="
cleos push action masteroracle addoracle '["ducororacle1"]' -p masteroracle@active --json
# echo "=== create user accounts ==="
# script for creating data into blockchain
# create_accounts.sh

# echo "=== create mock data for contract ==="
# script for calling actions on the smart contract to create mock data
# create_mock_data.sh

# * Replace the script with different form of data that you would pushed into the blockchain when you start your own project

echo "=== end of setup blockchain accounts and smart contract ==="
# create a file to indicate the blockchain has been initialized
touch "/mnt/dev/data/initialized"

jobs
# put the background nodeos job to foreground for docker run
fg %1