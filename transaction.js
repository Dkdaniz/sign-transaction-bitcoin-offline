/**
 * Objetivo transacao entre enderecos
 * Entrada: from, to, value, fee
 * Saida: Hash / Erro
 *  */    
const { createBitcoinRpc } = require('@carnesen/bitcoin-rpc');
const reverse = require('buffer-reverse');
const uint64LE = require('int64-buffer').Uint64LE;
const crypto = require('crypto');
const bip66 = require('bip66');
const ecc = require('tiny-secp256k1');
const secp256k1 = require('secp256k1');
const OPS = require('bitcoin-ops');
const bitcoinjs = require('bitcoinjs-lib');
const base58check = require('bs58check');
const Buffers = require('buffer').Buffer;

const rpcuser = 'suissa';
const rpcpassword = 'teste666';
const rpcHref = `http://${rpcuser}:${rpcpassword}@157.230.184.207:18332/`;
// const rpcHref = `http://${rpcuser}:${rpcpassword}@127.0.0.1:18332/`;
const bitcoinRpc = createBitcoinRpc(rpcHref);
// console.log({bitcoinRpc})
const ZERO = Buffer.alloc(1, 0);

const _from = '2NFPaxfumpBq5toTC76ts2nUZdPzwFpsxtV';
const _to = '2NGMAWK1sFnHbx7WgE6EUzGLwE5FRQtHoyP';
const _value = 0.00010000
const _fee = 0.00000006   // satoshi/byte

const getFeeFromBytes = (fee) => 189 * fee
const getOtxoWithAmount = (list, value) => list.filter((obj) => obj.amount > value);
const getscriptPubKey = async (_hashAddress) => { return await bitcoinRpc('validateaddress', [_hashAddress])}



const createTransaction = async (from = _from, to = _to, value = _value, fee = _fee) => { 
  
  console.log({from}, {to})
  const listunspent = await bitcoinRpc('listunspent')
  //console.log({listunspent})
  
  const otxo = listunspent.filter((obj) => obj.address == from)
  // console.log({otxo})
  
  const balance = await bitcoinRpc('getbalance', ["suissa", 6])
  // console.log({balance});

  const privkey = await bitcoinRpc('dumpprivkey', [from]);
  // console.log({privkey});

  if(balance > value){
    const vins = [];
    const vouts = [];
    let tx = { version: 1, locktime: 0, vins: [], vouts: [] }; 
    let txValues = 0;
    let i = 0;

    const validOtxo = getOtxoWithAmount(otxo, value);
    // const validOtxo = otxo.filter((obj) => obj.amount > value);

    if(validOtxo.length){
      //pega sempre primeiro as transacoes que sao menores, assim com o tempo a taxa fica mais barata
      for (i; txValues < value; i++) {
        txValues += validOtxo[i].amount
        vins.push({"txid" : otxo[i].txid,"vout" : otxo[i].vout, "scriptPubKey":otxo[i].scriptPubKey, "privateKey":privkey});
      }

      if(txValues>value){
        
        const feeEstimative =  (10 + (i * 146) + (i * 33)) * fee;
        
        let vlrTransaction = feeEstimative + value
        if(txValues > vlrTransaction){
          console.log("Sem funcao createTransaction");
          let scriptP2pkh = await getscriptPubKey(from);
          vouts.push({"value" : value, "script" : scriptP2pkh.scriptPubKey});

          if(vlrTransaction != txValues){
            let valueUnspent = (txValues - vlrTransaction).toFixed(8)
            scriptP2pkh = await getscriptPubKey(from);
            vouts.push({"value" : valueUnspent, "script" : scriptP2pkh.scriptPubKey});
          }
        }else{
          return signedTx(createTxWithOneInput(otxo,fee,value,privkey));
        }
       
        tx.vins = vins;
        tx.vouts = vouts;
        return signedTx(tx);
      }
      else{
        return  signedTx(createTxWithOneInput(otxo,fee,value,privkey));
      }
    }else{
      return  signedTx(createTxWithOneInput(otxo,fee,value,privkey));
    }
  }
  return false;
}

const createTxWithOneInput = (_otxo,_fee,_value,_privKey) => {
  const vins = [];
  const vouts = [];
  const tx = { version: 1, locktime: 0, vins: [], vouts: [] }; 

  validOtxo = _otxo.filter((obj) => obj.amount > _value);
  if(validOtxo.length > 0){
    vins.push({"txid" : otxo[0].txid,"vout" : otxo[0].vout, "scriptPubKey":otxo[0].scriptPubKey, "privateKey":_privKey});
    
    //186 byte * fee
    const feeEstimative = getFeeFromBytes(_fee); 

    let vlrTransaction = feeEstimative + _value

    if(validOtxo[0].amount > vlrTransaction){
      console.log("Com createTransaction")

      let valueUnspent = (validOtxo[0].amount - vlrTransaction).toFixed(8)
      var scriptP2pkh = getscriptPubKey(to);
      vouts.push({"value" : _value, "script" : scriptP2pkh});

      if(valueUnspent){
        scriptP2pkh = getscriptPubKey(from);
        vouts.push({"value" : valueUnspent, "script" : scriptP2pkh});
      }
    }
    console.log(vouts);
    console.log(vins);

    tx.vins = vins;
    tx.vouts = vouts;

    return tx;
  }
}

const createUnsignTx = (_tx) => {
  let data = []
  let version = Buffer.allocUnsafe(4);
  let numInputs = Buffer.allocUnsafe(1);
  let numOutputs = Buffer.allocUnsafe(1);
  let locktime = Buffer.allocUnsafe(4);

  version.writeUInt32LE(_tx.version);
  numInputs.writeInt8(_tx.vins.length);
  numOutputs.writeInt8(_tx.vouts.length);

  data.push(version);
  data.push(numInputs);

  for (let i in _tx.vins) {
    
    let txOutHash = Buffer.from(_tx.vins[i].txid,'hex');
    let txOutIndex = Buffer.allocUnsafe(4);
    let utxoScriptLenght = Buffer.allocUnsafe(1);
    let utxoScript = Buffer.from(_tx.vins[i].scriptPubKey,'hex');
    let sequence = Buffer.from('FFFFFFFF','hex');

    txOutIndex.writeUInt32LE(_tx.vins[i].vout);
    utxoScriptLenght.writeUInt8(utxoScript.length);
    
    data.push(reverse(txOutHash));
    data.push(txOutIndex);
    data.push(utxoScriptLenght);
    data.push(utxoScript);
    data.push(sequence);
  }

  data.push(numOutputs);

  for (let i in _tx.vouts) {
    let scriptLenght = Buffer.allocUnsafe(1);
    let script = Buffer.from(_tx.vouts[i].script,'hex');
    let value = new uint64LE(_tx.vouts[i].value)

    scriptLenght.writeUInt8(script.length);

    data.push(value.toBuffer());
    data.push(scriptLenght);
    data.push(script);
  }
  
  locktime.writeUInt32LE(_tx.locktime);
  data.push(locktime);
  
  return data;
}

const createSignedTx = (_tx, origArray) => {
  
  let pub = 'cRHfaZVp3Hkd2cFAaLekotvy73xa1bWpMRFySKyuqKERa8qnSV2Z'
  console.log(_tx);
  var decoded = base58check.decodeUnsafe('cRHfaZVp3Hkd2cFAaLekotvy73xa1bWpMRFySKyuqKERa8qnSV2Z')
  var decodeds = base58check.decode('cRHfaZVp3Hkd2cFAaLekotvy73xa1bWpMRFySKyuqKERa8qnSV2Z')
  const pri = new Buffers.from(pub.toString('hex'),'hex');
  console.log(pri);
  console.log(decodeds);
  console.log(decoded);
  console.log(pri.toString('hex'));

  // VEEWgYhDhqWnNnDCXXjirJYXGDFPjH1B8v6hmcnj1kLXrkpxArmz7xXw
  // cRHfaZVp3H kd2cFAaLek otvy73xa1b WpMRFySKyu qKERa8qnSV 2Z
  // b69ca8ffae36f11ad445625e35bf6ac57d6642ddbe470dd3e7934291b2000d78

  let signHash = Buffer.allocUnsafe(4);
  signHash.writeUInt32LE(1); 
  origArray.push(signHash);

  let transaction = '';
  for (let item in origArray) {
    transaction += origArray[item].toString('hex');
  }

  let data = [];
  let msg = Buffer.from(transaction,'hex');
  let version = Buffer.allocUnsafe(4);
  let numInputs = Buffer.allocUnsafe(1);
  let numOutputs = Buffer.allocUnsafe(1);
  const locktime =  Buffer.allocUnsafe(4);

  let hash256 = crypto.createHash('sha256').update(crypto.createHash('sha256').update(msg).digest()).digest();
  
  version.writeUInt32LE(_tx.version);
  numInputs.writeInt8(_tx.vins.length);
  numOutputs.writeInt8(_tx.vouts.length);
  data.push(version);
  data.push(numInputs);

  for (let i in _tx.vins) {
    const privateKey = decoded;
    const pubkey = secp256k1.publicKeyCreate(pri);
    const txOutHash = Buffer.from(_tx.vins[i].txid);
    const txOutIndex = Buffer.allocUnsafe(4);

    txOutIndex.writeUInt32LE(_tx.vins[i].vout);
    data.push(reverse(txOutHash))
    data.push(txOutIndex);

    //sign and encode
    const sig = ecc.sign(hash256, privateKey);

    const r = toOrder(sig.slice(0,32));
    const s = toOrder(sig.slice(32,64));
    const signature = bip66.encode(r, s);

    data.push(Buffer.from([signature.length+2+1+pubkey.length]));
    data.push(Buffer.from([signature.length+1]));
    data.push(signature);
    data.push(Buffer.from([1]));
    data.push(Buffer.from([pubkey.length]));
    data.push(Buffer.from([pubkey]));

    let sequence = Buffer.from('FFFFFFFF','hex');
    data.push(sequence);
  }

  data.push(numOutputs);

  

  for (let i in _tx.vouts) {
    const striptLength = Buffer.allocUnsafe(1);
    const script = Buffer.from(_tx.vouts[i].script,'hex');
    const value = new Uint64LE(_tx.vouts[i].value);

    striptLength.writeUInt8(script.length)

    data.push(value.toBuffer());
    data.push(scriptLenght);
    data.push(script);
  }
  
  locktime.writeUInt32LE(tx.locktime);
  data.push(locktime);

 

  return data;
}

const signedTx = (_tx) => {
  const unsignedTx = createUnsignTx(_tx);
  const signedTx = createSignedTx(_tx, unsignedTx);

  const transactionuUnsignedTx = '';
  for(let i in unsignedTx){
    transactionuUnsignedTx += unsignedTx[i].toString('hex'); 
  }
  console.log({transactionuUnsignedTx});

  const transactionSignedTx = '';
  for(let i in signedTx){
    transactionSignedTx += signedTx[i].toString('hex'); 
  }
  console.log({transactionSignedTx});

  const txHex = Buffer.from(transaction, 'hex');
  const txId = reverse(crypto.createHash('sha256').update(crypto.createHash('sha256').update(txHex)).digest().digest())
  console.log({txId});

  return txId;
}

const toOrder = (x) => {
  
  let i = 0;
  while(x[i]===0) i++;
  if(i === x.length) return ZERO;
  x=x.slice(i);
  if(x[0] & 0x80) return Buffer.concat([ZERO,x], 1 + x.length);
  return x;
}


try {
  createTransaction().then(hash => {
    console.log({hash})
  })
} catch (error) {
  console.log({error})
}




//create Tx object

// tx = {
//   version: 1,
//   vins:[
//     {
//       txid:'',
//       vout:'',
//       scriptPubKey:'',
//       privateKey:''
//     }
//   ],
//   vouts:[
//     {
//       value:'',
//       script:p2pkh(fromBase58Check(pubkey).hash)
//     }
//   ],
//   locktime:0
// }

// tx = {
//   version: 1,
//   inputs:[
//     {
//       previousOutputTxHash:'',
//       previousOutputTxIndex:'',
//       utxoScript:'',
//       privateKey:''
//     }
//   ],
//   outputs:[
//     {
//       value:'',
//       script:p2pkh(fromBase58Check(pubkey).hash)
//     }
//   ],
//   locktime:0
// }













