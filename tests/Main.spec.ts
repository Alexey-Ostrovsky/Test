import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Main');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let main: SandboxContract<Main>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        
        main = blockchain.openContract(Main.createFromConfig({
            ownerAddress: deployer.address,
            commission: 1,
            commissionAddress: deployer.address
        }, code));

        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('2.00'));


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
