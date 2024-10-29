import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox'
import { Cell, toNano, beginCell} from '@ton/core'
import { compile } from '@ton/blueprint'
import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto"
import '@ton/test-utils'


import { Main } from '../wrappers/Main'
import {JettonWallet} from '../wrappers/JettonWallet'
import {JettonMinter} from '../wrappers/JettonMinter'

const totalAmount = 1000000000000n
const defaultCommision = 1

describe('Main', () => {
    let mainCode: Cell
    let minterCode: Cell
    let walletCode: Cell

    let blockchain: Blockchain
    let deployerMinter: SandboxContract<TreasuryContract>
    let deployerMain: SandboxContract<TreasuryContract>
    let CommissionContract: SandboxContract<TreasuryContract>

    let keyPair : KeyPair
    let main: SandboxContract<Main>

    let jettonMinter: SandboxContract<JettonMinter>

    let mainJettonWallet: SandboxContract<JettonWallet>
    let minterJettonWallet: SandboxContract<JettonWallet>
    let commissionJettonWallet: SandboxContract<JettonWallet>

    beforeAll(async () => {
        minterCode = await compile('JettonMinter')
        walletCode = await compile('JettonWallet')
        mainCode = await compile('Main')

        blockchain = await Blockchain.create()

        //Minter infrastructure
        deployerMinter = await blockchain.treasury('deployerMinter')

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig({
                    jettonWalletCode: walletCode,
                    adminAddress: deployerMinter.address,
                    content: beginCell().storeStringTail('firstminter').endCell(),
                },
                minterCode
            )
        )

        //деплоим минтер
        await jettonMinter.sendDeploy(deployerMinter.getSender(), toNano(100))

        //деплоим кошелек на адрес админа минтера
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: totalAmount,
            queryId: 9,
            toAddress: deployerMinter.address,
            amount: toNano(1),
            value: toNano(2),
        })

        //получаем его instance из адреса
        minterJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(deployerMinter.address)
            )
        )

        //деплоим контракт для отсылки комиссии
        CommissionContract = await blockchain.treasury('deployerCommision')

        //деплоим джеттон-кошелек для коммиссии
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: 1000n,
            queryId: 11,
            toAddress: CommissionContract.address,
            amount: toNano(1),
            value: toNano(2),
        })

        //получаем его инстанс из адреса
        commissionJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(CommissionContract.address)
            )
        )

        //Main infrastructure
        deployerMain = await blockchain.treasury('deployerMain')


        keyPair = await mnemonicToPrivateKey(["help", "me", "somebody", "ooooh", "help", "me", "somebody", "oooooooh"]);
        main = blockchain.openContract(Main.createFromConfig({
            masterAddr: jettonMinter.address,
            walletCode: walletCode,
            publicKey: keyPair.publicKey,
            seqno: 0,
            ownerAddress: deployerMain.address,
            commission: defaultCommision,
            commissionAddress: CommissionContract.address
        }, mainCode))

        //деплоим мейн
        await main.sendDeploy(deployerMain.getSender(), toNano(100))

        //деплоим джеттон кошелек для main контракта
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: 1000n,
            queryId: 10,
            toAddress: main.address,
            amount: toNano(1),
            value: toNano(2),
        })

        //получаем его инстанс из адреса
        mainJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(main.address)
            )
        )
    })

    beforeEach(async () => {
    })

    it('check deploy', async() => {
        try {
            await jettonMinter.getTotalSupply()
            await minterJettonWallet.getWalletJettonAmount()
            await commissionJettonWallet.getWalletJettonAmount()
            await main.getCurrentState()
            await mainJettonWallet.getWalletJettonAmount()
        } catch (error) {
            console.log(error)
            expect(true).toEqual(false)
        }
    })

    it('check initial state', async() => {
        let result = await main.getCurrentState()
        expect(deployerMain.address.toString()).toEqual(result[0].toString())
        expect(defaultCommision).toEqual(result[1])
        expect(CommissionContract.address.toString()).toEqual(result[2].toString())
    })

    function abs(x: bigint) {
        return x > 0 ? x : -x;
    }

    it('commission test', async() => {
        const fuzzy = 50

        for(let i = 0; i < fuzzy; ++i) {
            let jettonTranferAmount = BigInt((Math.random() * 10000).toFixed(0) + 1)
            let expectedCommision = jettonTranferAmount / BigInt(100) * BigInt(defaultCommision)

            let currentCommisionAmount = await commissionJettonWallet.getWalletJettonAmount();

            let result = await minterJettonWallet.sendTransfer(deployerMinter.getSender(), {
                jettonAmount: jettonTranferAmount,
                queryId: 12,
                toAddress: main.address,
                fwdAmount: toNano(0.25),
                value: toNano(0.3),
            })

            expect(result.transactions).toHaveTransaction({
                from: minterJettonWallet.address,
                to: mainJettonWallet.address,
                success: true
            })

            expect(result.transactions).toHaveTransaction({
                from: mainJettonWallet.address,
                to: main.address,
                success: true
            })

            expect(result.transactions).toHaveTransaction({
                from: main.address,
                to: mainJettonWallet.address,
                success: true,
            })

            expect(result.transactions).toHaveTransaction({
                from: mainJettonWallet.address,
                to: commissionJettonWallet.address,
                success: true,
            })

            let resultCommisionAmount = await commissionJettonWallet.getWalletJettonAmount();
            let realCommision = resultCommisionAmount - currentCommisionAmount;
            expect(abs(realCommision - expectedCommision) < 2).toBe(true)
        }
    })

    it('withdraw test', async() => {
        const fuzzy = 50

        let withdrawJettonWalletAdmin: SandboxContract<TreasuryContract>
        withdrawJettonWalletAdmin = await blockchain.treasury('withdrawJettonAdmin')
        let withdrawJettonWallet: SandboxContract<JettonWallet>

        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: 100n,
            queryId: 9,
            toAddress: withdrawJettonWalletAdmin.address,
            amount: toNano(1),
            value: toNano(2),
        })

        //получаем его instance из адреса
        withdrawJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(withdrawJettonWalletAdmin.address)
            )
        )

        for(let i = 0; i < fuzzy; ++i) {
            let withdrawAmount = BigInt((Math.random() * 1000).toFixed(0) + 1)
            let fillAmount = withdrawAmount * (100n + BigInt(defaultCommision)) / 100n + 10n;

            await minterJettonWallet.sendTransfer(deployerMinter.getSender(), {
                jettonAmount: fillAmount,
                queryId: 12,
                toAddress: main.address,
                fwdAmount: toNano(0.25),
                value: toNano(0.3),
            })

            let mainAmountBeforeWithdraw = await mainJettonWallet.getWalletJettonAmount()
            let recieverWithdrawBeforeAmount = await withdrawJettonWallet.getWalletJettonAmount();

            let result = await main.sendWithdraw(deployerMain.getSender(), 
                toNano(0.3),
                i, 
                withdrawJettonWalletAdmin.address, 
                withdrawAmount
            )

            expect(result.transactions).toHaveTransaction({
                from: main.address,
                to: mainJettonWallet.address,
                success: true,
            })

            expect(result.transactions).toHaveTransaction({
                from:  mainJettonWallet.address,
                to: withdrawJettonWallet.address,
                success: true,
            })

            let mainAmountAfterWithdraw = await mainJettonWallet.getWalletJettonAmount()
            let recieverWithdrawAfterAmount = await withdrawJettonWallet.getWalletJettonAmount();
            expect(recieverWithdrawAfterAmount - recieverWithdrawBeforeAmount).toEqual(withdrawAmount)
            expect(mainAmountBeforeWithdraw - mainAmountAfterWithdraw).toEqual(withdrawAmount)
        }
    })

    it('test change admin', async () => {
        let InitialState = await main.getCurrentState()

        let testChangeAdmin: SandboxContract<TreasuryContract>
        testChangeAdmin = await blockchain.treasury('testChangeAdmin')

        await main.sendChangeAdmin(deployerMain.getSender(), toNano(0.05), 100, testChangeAdmin.address)

        let MutatedState = await main.getCurrentState()

        expect(MutatedState[0].toString()).toEqual(testChangeAdmin.address.toString())
        expect(MutatedState[1]).toEqual(InitialState[1])
        expect(MutatedState[2].toString()).toEqual(InitialState[2].toString())
    })

    it('should destroy externaly', async() => {
        let result = await main.sendExtMessage(0x7c4a867b, 0, keyPair);
    })
})