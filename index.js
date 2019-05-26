const Client = require('bitcoin-core');
const client = new Client({ network: 'testnet', username: 'suissa', password: 'teste666' });
// const client = new Client({ port: 18332 });

// console.log({client});
// client.getnetworkinfo().then((help) => console.log(help));

;(async () => {

  try {
    const result = await client.getBlockchainInformation()
    
  } catch (error) {
    console.log({error})
  }

  console.log({result})
})()
