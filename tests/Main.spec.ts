import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address, beginCell} from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils'
import {JettonWallet} from '../wrappers/JettonWallet';
import {JettonMinter} from '../wrappers/JettonMinter';

import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { checkPrime } from 'crypto';

const totalAmount = 1000000000000n;
const defaultCommision = 1;

describe('Main', () => {
    let mainCode: Cell;
    let minterCode: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');
        mainCode = await compile('Main');
    });

    let blockchain: Blockchain;
    let deployerMinter: SandboxContract<TreasuryContract>;
    let deployerMain: SandboxContract<TreasuryContract>;
    let CommissionContract: SandboxContract<TreasuryContract>;

    let main: SandboxContract<Main>;

    let jettonMinter: SandboxContract<JettonMinter>;

    let mainJettonWallet: SandboxContract<JettonWallet>;
    let minterJettonWallet: SandboxContract<JettonWallet>;
    let commissionJettonWallet: SandboxContract<JettonWallet>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();

        //Minter infrastructure
        deployerMinter = await blockchain.treasury('deployerMinter');

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig({
                    jettonWalletCode: walletCode,
                    adminAddress: deployerMinter.address,
                    content: beginCell().storeStringTail('firstminter').endCell(),
                },
                minterCode
            )
        );

        //деплоим минтер
        await jettonMinter.sendDeploy(deployerMinter.getSender(), toNano(100));

        //деплоим кошелек на адрес админа минтера
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: totalAmount,
            queryId: 9,
            toAddress: deployerMinter.address,
            amount: toNano(1),
            value: toNano(2),
        });

        //получаем его instance из адреса
        minterJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(deployerMinter.address)
            )
        );


        //деплоим контракт для отсылки комиссии
        CommissionContract = await blockchain.treasury('deployerCommision');

        //деплоим джеттон-кошелек для коммиссии
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: 1000n,
            queryId: 11,
            toAddress: CommissionContract.address,
            amount: toNano(1),
            value: toNano(2),
        });

        //получаем его инстанс из адреса
        commissionJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(CommissionContract.address)
            )
        );


        //Main infrastructure
        deployerMain = await blockchain.treasury('deployerMain');

        main = blockchain.openContract(Main.createFromConfig({
            masterAddr: jettonMinter.address,
            walletCode: walletCode,
            ownerAddress: deployerMain.address,
            commission: defaultCommision,
            commissionAddress: CommissionContract.address
        }, mainCode));

        //деплоим мейн
        await main.sendDeploy(deployerMain.getSender(), toNano(100));

        //деплоим джеттон кошелек для main контракта
        await jettonMinter.sendMint(deployerMinter.getSender(), {
            jettonAmount: 1000n,
            queryId: 10,
            toAddress: main.address,
            amount: toNano(1),
            value: toNano(2),
        });

        //получаем его инстанс из адреса
        mainJettonWallet = blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(main.address)
            )
        );
    });

    it('check initial state', async() => {
        let result = await main.getCurrentState();
        expect(deployerMain.address.toString()).toEqual(result[0].toString());
        expect(defaultCommision).toEqual(result[1]);
        expect(CommissionContract.address.toString()).toEqual(result[2].toString());
    })

    it('test change admin', async () => {
        let InitialState = await main.getCurrentState();

        let testChangeAdmin: SandboxContract<TreasuryContract>;
        testChangeAdmin = await blockchain.treasury('testChangeAdmin');

        await main.sendChangeAdmin(deployerMain.getSender(), toNano(0.05), 100, testChangeAdmin.address);

        let MutatedState = await main.getCurrentState();

        expect(MutatedState[0].toString()).toEqual(testChangeAdmin.address.toString());
        expect(MutatedState[1]).toEqual(InitialState[1]);
        expect(MutatedState[2].toString()).toEqual(InitialState[2].toString());
    });

    it('commission test', async() => {
        const jettonTranferAmount = 500n;

        console.log(await commissionJettonWallet.getWalletJettonAmount());
        console.log(await mainJettonWallet.getWalletJettonAmount());
        console.log(await minterJettonWallet.getWalletJettonAmount());

        let result = await minterJettonWallet.sendTransfer(deployerMinter.getSender(), {
            jettonAmount: jettonTranferAmount,
            queryId: 12,
            toAddress: main.address,
            fwdAmount: toNano(1),
            value: toNano(2),
        });

        console.log("commision jetton wallet: " + commissionJettonWallet.address.toString());
        console.log("main jetton wallet: " + mainJettonWallet.address.toString());
        console.log("main: " + main.address.toString());

        expect(result.transactions).toHaveTransaction({
            from: main.address,
            to: mainJettonWallet.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: mainJettonWallet.address,
            to: commissionJettonWallet.address,
            success: true,
        });

        console.log(await commissionJettonWallet.getWalletJettonAmount());
        console.log(await mainJettonWallet.getWalletJettonAmount());
        console.log(await minterJettonWallet.getWalletJettonAmount());
    });

});