import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, storeStateInit } from '@ton/core';

//run npx bluprint build (jetton-wallet.fc) at first
import walletHex from "../build/JettonWallet.compiled.json";

const JETTON_WALLET_CODE = Cell.fromBoc(Buffer.from(walletHex.hex, 'hex'))[0];
const JETTON_MASTER_ADDRESS = Address.parse('EQCpj4ZJAkcNDfQZ0Cs9hlYhD9Te9H7M_TY7pxPcRVvtDuNo');

export type MainConfig = {
    ownerAddress: Address;
    commission : number;
};

export function mainConfigToCell(config: MainConfig): Cell {
    return  beginCell()
                .storeAddress(JETTON_MASTER_ADDRESS)
                .storeRef(JETTON_WALLET_CODE)
                .storeAddress(config.ownerAddress)
                .storeUint(config.commission, 8)
            .endCell();
}

export class Main implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Main(address);
    }

    static createFromConfig(config: MainConfig, code: Cell, workchain = 0) {
        const data = mainConfigToCell(config);
        const init = { code, data };
        return new Main(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
