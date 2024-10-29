import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, Slice, storeStateInit } from '@ton/core';
import { KeyPair, sign } from '@ton/crypto';

export type MainConfig = {
    masterAddr: Address;
    walletCode: Cell;
    publicKey: Buffer;

    seqno: 0;
    ownerAddress: Address;
    commission : number;
    commissionAddress: Address;
};

export function mainConfigToCell(config: MainConfig): Cell {
    var immutable = beginCell()
        .storeAddress(config.masterAddr)
        .storeRef(config.walletCode)
        .storeBuffer(config.publicKey)
    .endCell();

    return  beginCell()
                .storeRef(immutable)

                .storeUint(config.seqno, 32)
                .storeAddress(config.ownerAddress)
                .storeUint(config.commission, 8)
                .storeAddress(config.commissionAddress)
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

    async sendChangeAdmin(provider: ContractProvider, via: Sender, value: bigint, query_id: number, new_admin: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body:   beginCell()
                        .storeUint(0x2da38aaf, 32)
                        .storeUint(query_id, 64)
                        .storeAddress(new_admin)
                    .endCell()
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender, value: bigint, query_id: number, reciever: Address, jetton_amount: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body:   beginCell()
                        .storeUint(0x41836980, 32)
                        .storeUint(query_id, 64)
                        .storeCoins(jetton_amount)
                        .storeAddress(reciever)
                        .storeUint(0, 8)
                    .endCell()
        });
    }

    async sendExtMessage(provider: ContractProvider, opCode: number, seqno: number, keys: KeyPair) {
        const msg = beginCell()
            .storeUint(seqno, 32)
            .storeUint(opCode, 32)
        .endCell()

        const msgSign = sign(msg.hash(), keys.secretKey);

        return await provider.external(
            beginCell()
                .storeBuffer(msgSign)
                .storeSlice(msg.asSlice())
            .endCell()
        )
    }

    async getCurrentState(provider: ContractProvider) : Promise<[Address, number, Address]> {
        const result = await provider.get('get_current_state', []);

        let seqno: number = result.stack.readNumber();
        let admin_addr: Address = result.stack.readAddress();
        let commission_prescent: number = result.stack.readNumber();
        let commission_addr: Address = result.stack.readAddress();
        return [ admin_addr, commission_prescent, commission_addr ];
    }

    async getCurrentSeqno(provider: ContractProvider) : Promise<number> {
        const result = await provider.get('get_current_seqno', []);

        let seqno: number = result.stack.readNumber();
        return seqno;
    }
}
