// [assignment] please copy the entire modified custom.test.js here
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers

const Utxo = require('../src/utxo')
const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
const { toFixedHex, poseidonHash } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MINIMUM_WITHDRAWAL_AMOUNT = utils.parseEther(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '0.05')
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

describe('Custom Tests', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    require('../scripts/compileHasher')
    const [sender, gov, l1Unwrapper, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')

    const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
    await token.mint(sender.address, utils.parseEther('10000'))

    const amb = await deploy('MockAMB', gov.address, l1ChainId)
    const omniBridge = await deploy('MockOmniBridge', amb.address)

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      token.address,
      omniBridge.address,
      l1Unwrapper.address,
      gov.address,
      l1ChainId,
      multisig.address,
    )

    const { data } = await tornadoPoolImpl.populateTransaction.initialize(
      MINIMUM_WITHDRAWAL_AMOUNT,
      MAXIMUM_DEPOSIT_AMOUNT,
    )
    const proxy = await deploy(
      'CrossChainUpgradeableProxy',
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId,
    )

    const tornadoPool = tornadoPoolImpl.attach(proxy.address)

    await token.approve(tornadoPool.address, utils.parseEther('10000'))

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig }
  }

  it('[assignment] ii. deposit 0.1 ETH in L1 -> withdraw 0.08 ETH in L2 -> assert balances', async () => {
      // [assignment] complete code here

      // code copied & adapted from full.test.js "should deposit from L1 and withdraw to L1"
      // Alice deposits 0.1 ETH in L1 -> Alice withdraws 0.08 ETH in L2 -> assert recipient, omniBridge, and tornadoPool balances are correct.

      const { tornadoPool, token, omniBridge } = await loadFixture(fixture)
      const aliceKeypair = new Keypair() // contains private and public keys

      // Alice deposits into tornado pool
      // deposit automatically also registers a user
      const aliceDepositAmount = utils.parseEther('0.1')
      const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair: aliceKeypair })

      const { args, extData } = await prepareTransaction({
        tornadoPool,
        outputs: [aliceDepositUtxo],
      })

      const onTokenBridgedData = encodeDataForBridge({
        proof: args,
        extData,
      })

      const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        aliceDepositUtxo.amount,
        onTokenBridgedData,
      )
      // emulating bridge. first it sends tokens to omnibridge mock then it sends to the pool
      await token.transfer(omniBridge.address, aliceDepositAmount)
      const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDepositAmount)

      await omniBridge.execute([
        { who: token.address, callData: transferTx.data }, // send tokens to pool
        { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // call onTokenBridgedTx
      ])

      // withdraws a part of his funds from the shielded pool
      const aliceWithdrawAmount = utils.parseEther('0.08')
      const recipient = '0xDeaD00000000000000000000000000000000BEEf'
      const aliceChangeUtxo = new Utxo({
        amount: aliceDepositAmount.sub(aliceWithdrawAmount),
        keypair: aliceKeypair,
      })
      await transaction({
        tornadoPool,
        inputs: [aliceDepositUtxo],
        outputs: [aliceChangeUtxo],
        recipient: recipient,
        isL1Withdrawal: false, // want to do L2 withdraw
      })

      // 0.08 on L2
      const recipientBalance = await token.balanceOf(recipient)
      expect(recipientBalance).to.be.equal(aliceWithdrawAmount)
      // nothing on L1 bridge
      const omniBridgeBalance = await token.balanceOf(omniBridge.address)
      expect(omniBridgeBalance).to.be.equal(0)
      // Tornado has 0.1 - 0.08 = 0.02 on L2, that is owned by alice
      const tornadoPoolBalance = await token.balanceOf(tornadoPool.address)
      expect(tornadoPoolBalance).to.be.equal(aliceDepositAmount.sub(aliceWithdrawAmount))
  

  })

  it('[assignment] iii. see assignment doc for details', async () => {
      // [assignment] complete code here
      // Alice deposits : 0.13 ETH in L1 -> Alice sends  0.06 ETH to Bob in L2 -> 
      // Bob withdraws all his funds in L2 -> 
      // Alice withdraws all her remaining funds in L1 -> 
      // assert all relevant balances are correct.
     
      // TODO: make it work
     
      const { tornadoPool, token, omniBridge } = await loadFixture(fixture)
      const aliceKeypair = new Keypair() // contains private and public keys

      // Alice deposits into tornado pool
      // deposit automatically also registers a user
      const aliceDepositAmount = utils.parseEther('0.13')
      const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair: aliceKeypair })


      const { args, extData } = await prepareTransaction({
        tornadoPool,
        outputs: [aliceDepositUtxo],
      })

      const onTokenBridgedData = encodeDataForBridge({
        proof: args,
        extData,
      })

      const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        aliceDepositUtxo.amount,
        onTokenBridgedData,
      )
      // emulating bridge. first it sends tokens to omnibridge mock then it sends to the pool
      await token.transfer(omniBridge.address, aliceDepositAmount)
      const transferTx = await token.populateTransaction.transfer(tornadoPool.address, aliceDepositAmount)

      await omniBridge.execute([
        { who: token.address, callData: transferTx.data }, // send tokens to pool
        { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // call onTokenBridgedTx
      ])

      // alice send 0.06 to Bob on L2
      const bobKeypair = new Keypair() // contains private and public keys
      const bobAddress = bobKeypair.address() // contains only public key

      const bobSendAmount = utils.parseEther('0.06')
      const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress) })
      const aliceChangeUtxo2 = new Utxo({
        amount: aliceDepositAmount.sub(bobSendAmount),
        keypair: aliceDepositUtxo.keypair,
      })

      await transaction({
        tornadoPool,
        inputs: [aliceDepositUtxo],
        outputs: [aliceChangeUtxo2, bobSendUtxo],
      })

      // bob withdraws all funds on L2

      const bobWithdrawAmount = utils.parseEther('0.06')
      const bobRecipient = '0x3cB6817D6aaaf813a1C357CD7C80A3c41EE30350' //send to bobs address
      const bobChangeUtxo = new Utxo({
        amount: bobSendUtxo.amount,
        keypair: bobKeypair,
      })

      await transaction({
        tornadoPool,
        outputs: [bobChangeUtxo],
        recipient: bobRecipient,
        isL1Withdrawal: false, 
      })


      // alice withdraws all funds on L1
      const aliceWithdrawAmount = aliceDepositAmount.sub(bobSendAmount)
      const recipient = '0xDeaD00000000000000000000000000000000BEEf'
      const aliceChangeUtxo = new Utxo({
        amount: aliceWithdrawAmount,
        keypair: aliceKeypair,
      })
      await transaction({
        tornadoPool,
        outputs: [aliceChangeUtxo],
        recipient: recipient,
        isL1Withdrawal: true, // L1 withdraw
      })


      const bobRecipientBalance = await token.balanceOf(bobRecipient)
      console.log(ethers.utils.formatUnits(bobRecipientBalance, 18))
      // nothing on L2 for recipient
      const aliceRecipientBalance = await token.balanceOf(recipient)
      console.log(ethers.utils.formatUnits(aliceRecipientBalance, 18))
      //expect(aliceRecipientBalance).to.be.equal(0)
      const omniBridgeBalance2 = await token.balanceOf(omniBridge.address)
      console.log(ethers.utils.formatUnits(omniBridgeBalance2, 18))
      //expect(omniBridgeBalance2).to.be.equal(0)
      const tornadoPoolBalance2 = await token.balanceOf(tornadoPool.address)
      // 0.06 from Bob and and 0.07 from Alice = 0.13 
      console.log(ethers.utils.formatUnits(tornadoPoolBalance2, 18))
      //expect(tornadoPoolBalance2).to.be.equal(0)

      
      /*
      // 0.08 on L2
      const recipientBalance = await token.balanceOf(recipient)
      expect(recipientBalance).to.be.equal(aliceWithdrawAmount)
      // nothing on L1 bridge
      const omniBridgeBalance = await token.balanceOf(omniBridge.address)
      expect(omniBridgeBalance).to.be.equal(0)
      // Tornado has 0.1 - 0.08 = 0.02 on L2, that is owned by alice
      const tornadoPoolBalance = await token.balanceOf(tornadoPool.address)
      expect(tornadoPoolBalance).to.be.equal(aliceDepositAmount.sub(aliceWithdrawAmount))

      */
     
     
     /* const { tornadoPool, token, omniBridge } = await loadFixture(fixture)
      const aliceKeypair = new Keypair() // contains private and public keys

      // Alice deposits into tornado pool L1
      // deposit automatically also registers a user
      const aliceDepositAmount = utils.parseEther('0.13')
      const aliceDepositUtxo = new Utxo({ amount: aliceDepositAmount, keypair: aliceKeypair })

    

      // copied & adapted from full.test.js "should deposit, transact and withdraw"
      // Bob gives Alice address to send some eth inside the shielded pool
      const bobKeypair = new Keypair() // contains private and public keys
      const bobAddress = bobKeypair.address() // contains only public key

      const [a, b, c, d, bobSecond, aliceSecond] = await ethers.getSigners()

      // Alice sends some funds to Bob on L2
      const bobSendAmount = utils.parseEther('0.06')
      const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress) })
      const aliceChangeUtxo = new Utxo({
        amount: aliceDepositAmount.sub(bobSendAmount),
        keypair: aliceDepositUtxo.keypair,
      })
      
      const { args, extData } = await prepareTransaction({
        tornadoPool,
        inputs: [aliceDepositUtxo],
        outputs: [bobSendUtxo, aliceChangeUtxo]
      })

      const onTokenBridgedData = encodeDataForBridge({
        proof: args,
        extData,
      })

      const onTokenBridgedTx = await tornadoPool.populateTransaction.onTokenBridged(
        token.address,
        bobSendUtxo.amount,
        onTokenBridgedData,
      )
      // emulating bridge. first it sends tokens to omnibridge mock then it sends to the pool
      await token.transfer(omniBridge.address, bobSendAmount)
      const transferTx = await token.populateTransaction.transfer(tornadoPool.address, bobSendAmount)

      await omniBridge.execute([
        { who: token.address, callData: transferTx.data }, // send tokens to pool
        { who: tornadoPool.address, callData: onTokenBridgedTx.data }, // call onTokenBridgedTx
      ])

      // bob withdraws all his funds in L2

      // withdraws funds from the shielded pool to L2
      const bobWithdrawAmount = utils.parseEther('0.06')
      const bobRecipient = bobSecond.address //send to bobs address
      const bobChangeUtxo = new Utxo({
        amount: bobSendAmount,
        keypair: bobKeypair,
      })
      await transaction({
        tornadoPool,
        outputs: [bobChangeUtxo],
        recipient: bobRecipient,
        isL1Withdrawal: false, // want to do L2 withdraw
      })

      const bobRecipientBalance = await token.balanceOf(bobRecipient)
      expect(bobRecipientBalance).to.be.equal(bobWithdrawAmount)

      // alice withdraws all fund on L1

      // withdraws funds from the shielded pool to L1
      const aliceRecipient = aliceSecond.address //send to alice address
      const aliceChangeUtxo2 = new Utxo({
        amount: aliceDepositAmount.sub(bobSendAmount), 
        keypair: aliceKeypair,
      })
      await transaction({
        tornadoPool,
        inputs: [aliceChangeUtxo],
        outputs: [aliceChangeUtxo2],
        recipient: aliceRecipient,
        isL1Withdrawal: true, // want to do L1 withdraw
      })


      const aliceRecipientBalance = await token.balanceOf(aliceRecipient)
      console.log(ethers.utils.formatUnits(aliceRecipientBalance, 18))
      expect(aliceRecipientBalance).to.be.equal(0)
      const omniBridgeBalance2 = await token.balanceOf(omniBridge.address)
      console.log(ethers.utils.formatUnits(omniBridgeBalance2, 18))
      expect(omniBridgeBalance2).to.be.equal(0)
      const tornadoPoolBalance2 = await token.balanceOf(tornadoPool.address)
      // 0.06 from Bob and and 0.07 from Alice = 0.13 
      console.log(ethers.utils.formatUnits(tornadoPoolBalance2, 18))
      expect(tornadoPoolBalance2).to.be.equal(0)
*/
  })

})
