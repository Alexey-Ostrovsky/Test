import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import {JettonWallet} from '../wrappers/JettonWallet';
import {JettonMinter} from '../wrappers/JettonMinter';

import '@ton/test-utils';
import { compile } from '@ton/blueprint';


describe('Main', () => {
    let mainCode: Cell;
    let minterCode: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
        mainCode = await compile('Main');
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;

    let main: SandboxContract<Main>;
    let mainJettonWallet: SandboxContract<JettonWallet>;
    let JettonMinter: SandboxContract<JettonMinter>;
    
    let SenderJettonWallet: SandboxContract<JettonWallet>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        
        main = blockchain.openContract(Main.createFromConfig({
            ownerAddress: deployer.address,
            commission: 1,
            commissionAddress: deployer.address
        }, mainCode));

        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('2.00'));

        //minter??

        //jettonWallet - direct owning by deployer      
        //jettonWallet - owning by main contract             x
        //create another deployer - change admin
        //commision address - create another deployer + jettonWallet on that address
        //withdraw address - same as commission

        console.log(deployResult.transactions);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        let result = await main.getCurrentState();

        console.log(result[0]);
        console.log(result[1]);
        console.log(result[2]);

        let yet_another_result = await main.sendChangeAdmin(deployer.getSender(), toNano(0.05), 100, deployer.address);

        console.log(yet_another_result.transactions);
    });
});
