import type { AccountOptions, LedgerAddress, LedgerSignature, LedgerTypes, LedgerVersion } from '@polkadot/hw-ledger/types';
import type { ResponseBase, SubstrateApp } from '@zondax/ledger-polkadot';
import HttpTransport from '@ledgerhq/hw-transport-http/lib/HttpTransport';
import { Ledger } from '@polkadot/hw-ledger';
import { LEDGER_DEFAULT_ACCOUNT, LEDGER_DEFAULT_CHANGE, LEDGER_DEFAULT_INDEX, LEDGER_SUCCESS_CODE } from '@polkadot/hw-ledger/constants';
import { ledgerApps } from '@polkadot/hw-ledger/defaults';
import { assert, u8aToBuffer } from '@polkadot/util'

const transport = {
  create: () => {
    console.log({ HttpTransport });
    return HttpTransport.open("http://127.0.0.1:9998")
  },
  type: "webusb"
}

type Chain = keyof typeof ledgerApps;
type LedgerClass = Omit<typeof Ledger, 'prototype'>;

export class LedgerHttp implements LedgerClass {
  #app: SubstrateApp | null = null;
  #chain: Chain;

  constructor (_: LedgerTypes, chain: Chain) {
    this.#chain = chain;
  }

   public async getAddress (confirm = false, accountOffset = 0, addressOffset = 0, { account = LEDGER_DEFAULT_ACCOUNT, addressIndex = LEDGER_DEFAULT_INDEX, change = LEDGER_DEFAULT_CHANGE }: Partial<AccountOptions> = {}): Promise<LedgerAddress> {
    return this.#withApp(async (app: SubstrateApp): Promise<LedgerAddress> => {
      const { address, pubKey } = await this.#wrapError(app.getAddress(account + accountOffset, change, addressIndex + addressOffset, confirm));

      return {
        address,
        publicKey: `0x${pubKey}`
      };
    });
  }

  public async getVersion (): Promise<LedgerVersion> {
    return this.#withApp(async (app: SubstrateApp): Promise<LedgerVersion> => {
      const { device_locked: isLocked, major, minor, patch, test_mode: isTestMode } = await this.#wrapError(app.getVersion());

      return {
        isLocked,
        isTestMode,
        version: [major, minor, patch]
      };
    });
  }

  public async sign (message: Uint8Array, accountOffset = 0, addressOffset = 0, { account = LEDGER_DEFAULT_ACCOUNT, addressIndex = LEDGER_DEFAULT_INDEX, change = LEDGER_DEFAULT_CHANGE }: Partial<AccountOptions> = {}): Promise<LedgerSignature> {
    return this.#withApp(async (app: SubstrateApp): Promise<LedgerSignature> => {
      const buffer = u8aToBuffer(message);
      const { signature } = await this.#wrapError(app.sign(account + accountOffset, change, addressIndex + addressOffset, buffer));

      return {
        signature: `0x${signature.toString('hex')}`
      };
    });
  }

  #getApp = async (): Promise<SubstrateApp> => {
    if (!this.#app) {
      const tr = await transport.create();

      this.#app = ledgerApps[this.#chain](tr);
    }

    return this.#app;
  };

  #withApp = async <T> (fn: (app: SubstrateApp) => Promise<T>): Promise<T> => {
    try {
      const app = await this.#getApp();

      return await fn(app);
    } catch (error) {
      this.#app = null;

      throw error;
    }
  };

  #wrapError = async <T extends ResponseBase> (promise: Promise<T>): Promise<T> => {
    const result = await promise;

    assert(result.return_code === LEDGER_SUCCESS_CODE, () => result.error_message);

    return result;
  };
}
