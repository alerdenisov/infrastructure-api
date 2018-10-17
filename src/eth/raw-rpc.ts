import axios from 'axios';

export async function rpcCall(method: string, ...params: any[]): Promise<any> {
  const { data } = await axios.post(
    process.env.ETH_RPC,
    {
      method,
      params,
      id: 1,
      jsonrpc: '2.0',
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  return data;
}
