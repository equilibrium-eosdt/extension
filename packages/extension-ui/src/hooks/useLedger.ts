// Copyright 2019-2021 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Ledger } from '@polkadot/hw-ledger';
import { Network } from '@polkadot/networks/types';
import uiSettings from '@polkadot/ui-settings';
import { assert } from '@polkadot/util';

import ledgerChains from '../util/legerChains';
import { LedgerHttp } from "./ledger-http";
import useTranslation from './useTranslation';

interface StateBase {
  isLedgerCapable: boolean;
  isLedgerEnabled: boolean;
}

interface State extends StateBase {
  address: string | null;
  error: string | null;
  isLedgerCapable: boolean;
  isLedgerEnabled: boolean;
  isLoading: boolean;
  isLocked: boolean;
  ledger: Ledger | null;
  refresh: () => void;
  warning: string | null;
}

function getNetwork (genesis: string): Network | undefined {
  const defaultChain = ledgerChains.find(({ genesisHash }) => genesisHash[0] === genesis);

  if (!defaultChain) {
    const keys = window.localStorage.getItem("customNetCount");
    let netCount = Number(keys);
    netCount = Number.isFinite(netCount) ? netCount : 0;

    for (let i = 0; i < netCount; ++i) {
      const net = window.localStorage.getItem(`customNet${i}`);

      if (net) {
        const [gen, name, lgType] = net.split(",");

        if (gen === genesis) {
          return {
            genesisHash: [gen],
            displayName: name,
            network: name,
            hasLedgerSupport: true,
            decimals: null,
            prefix: 42,
            standardAccount: null,
            symbols: null,
            website: null,
            icon: "polkadot",
            isIgnored: false,
            // @ts-ignore
            isHttp: lgType === "http"
          };
        }
      }
    }

    return undefined;
  } else {
    return defaultChain;
  }
}

function retrieveLedger (genesis: string): Ledger {
  let ledger: Ledger | null = null;

  const { isLedgerCapable } = getState();

  assert(isLedgerCapable, 'Incompatible browser, only Chrome is supported');

  const def = getNetwork(genesis);

  if (!def && genesis.split(",").length >= 3) {
    const [, net, lgType] = genesis.split(",");
    const keys = window.localStorage.getItem("customNetCount");
    let netCount = Number(keys);
    netCount = Number.isFinite(netCount) ? netCount : 0;
    let found = false;

    for (let i = 0; i < netCount; ++i) {
      const net = window.localStorage.getItem(`customNet${i}`);

      if (net === genesis) {
        found = true;
      }
    }

    if (!found) {
      window.localStorage.setItem(`customNet${netCount}`, genesis);
      window.localStorage.setItem("customNetCount", (netCount + 1).toString());
    }

    if (lgType !== "http") {
      return new Ledger("webusb", net)
    } else {
      return new LedgerHttp("webusb", net) as unknown as Ledger;
    }

  } else {
    assert(def, `Unable to find supported chain for ${genesis}`);

    // @ts-ignore
    if (def.isHttp) {
      return new LedgerHttp("webusb", def.network) as unknown as Ledger;
    } else {
      ledger = new Ledger('webusb', def.network);
    }

    return ledger;
  }
}

function getState (): StateBase {
  const isLedgerCapable = !!(window as unknown as { USB?: unknown }).USB;

  return {
    isLedgerCapable,
    isLedgerEnabled: isLedgerCapable && uiSettings.ledgerConn !== 'none'
  };
}

export function useLedger (genesis?: string | null, accountIndex = 0, addressOffset = 0): State {
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [refreshLock, setRefreshLock] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const { t } = useTranslation();
  const ledger = useMemo(() => {
    setIsLocked(false);
    setRefreshLock(false);

    // this trick allows to refresh the ledger on demand
    // when it is shown as locked and the user has actually
    // unlocked it, which we can't know.
    if (refreshLock || genesis) {
      if (!genesis) {
        return null;
      }

      return retrieveLedger(genesis);
    }

    return null;
  }, [genesis, refreshLock]);

  useEffect(() => {
    if (!ledger || !genesis) {
      setAddress(null);

      return;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    ledger.getAddress(false, accountIndex, addressOffset)
      .then((res) => {
        setIsLoading(false);
        setAddress(res.address);
      }).catch((e: Error) => {
        setIsLoading(false);
        const { network } = getNetwork(genesis) || { network: 'unknown network' };

        const warningMessage = e.message.includes('Code: 26628')
          ? t<string>('Is your ledger locked?')
          : null;

        const errorMessage = e.message.includes('App does not seem to be open')
          ? t<string>('App "{{network}}" does not seem to be open', { replace: { network } })
          : e.message;

        setIsLocked(true);
        setWarning(warningMessage);
        setError(t<string>(
          'Ledger error: {{errorMessage}}',
          { replace: { errorMessage } }
        ));
        console.error(e);
        setAddress(null);
      });
  // If the dependency array is exhaustive, with t, the translation function, it
  // triggers a useless re-render when ledger device is connected.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIndex, addressOffset, genesis, ledger]);

  const refresh = useCallback(() => {
    setRefreshLock(true);
    setError(null);
    setWarning(null);
  }, []);

  return ({ ...getState(), address, error, isLoading, isLocked, ledger, refresh, warning });
}
