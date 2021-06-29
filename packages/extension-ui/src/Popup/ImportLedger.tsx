// Copyright 2019-2021 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { faSync } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import settings from '@polkadot/ui-settings';

import { ActionContext, Address, Button, ButtonArea, Dropdown, InputWithLabel, VerticalSpace, Warning } from '../components';
import { useLedger } from '../hooks/useLedger';
import useTranslation from '../hooks/useTranslation';
import { createAccountHardware } from '../messaging';
import { Header, Name } from '../partials';
import { ThemeProps } from '../types';
import ledgerChains from '../util/legerChains';

interface AccOption {
  text: string;
  value: number;
}

interface NetworkOption {
  text: string;
  value: string | null;
}

const AVAIL: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

interface Props extends ThemeProps {
  className?: string;
}

function ImportLedger ({ className }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [accountIndex, setAccountIndex] = useState<number>(0);
  const [addressOffset, setAddressOffset] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [rawGenesis, setGenesis] = useState<string | null>(null);
  const [custom, setCustom] = useState<string>();
  const genesis = useMemo(() => rawGenesis?.toUpperCase().includes("#CUSTOM#") ? custom : rawGenesis, [custom, rawGenesis]);
  const onAction = useContext(ActionContext);
  const [name, setName] = useState<string | null>(null);
  const { address, error: ledgerError, isLoading: ledgerLoading, isLocked: ledgerLocked, refresh, warning: ledgerWarning } = useLedger(genesis, accountIndex, addressOffset);

  useEffect(() => {
    if (address) {
      settings.set({ ledgerConn: 'webusb' });
    }
  }, [address]);

  const accOps = useRef(AVAIL.map((value): AccOption => ({
    text: t('Account type {{index}}', { replace: { index: value } }),
    value
  })));

  const addOps = useRef(AVAIL.map((value): AccOption => ({
    text: t('Address index {{index}}', { replace: { index: value } }),
    value
  })));

  const customNetworkOps = useMemo(() => {
    const keys = window.localStorage.getItem("customNetCount");
    const netCount = Number(keys);

    if (!keys || !Number.isFinite(netCount)) {
      return [];
    }

    const nets = [];

    for (let i = 0; i < netCount; ++i) {
      const net = window.localStorage.getItem(`customNet${i}`);

      if (net) {
        nets.push({ text: net, value: net });
      }
    }

    return nets;
  }, [])

  const networkOps = useRef(
    [{
      text: t('Select network'),
      value: ''
    },
    ...ledgerChains.map(({ displayName, genesisHash }): NetworkOption => ({
      text: displayName,
      value: genesisHash[0]
    })),
    ...customNetworkOps, {
      text: t('Custom'),
      value: "#CUSTOM#"
    }]
  );

  const _onSave = useCallback(
    () => {
      if (address && genesis && name) {
        setIsBusy(true);

        createAccountHardware(address, 'ledger', accountIndex, addressOffset, name, genesis)
          .then(() => onAction('/'))
          .catch((error: Error) => {
            console.error(error);

            setIsBusy(false);
            setError(error.message);
          });
      }
    },
    [accountIndex, address, addressOffset, genesis, name, onAction]
  );

  // select element is returning a string
  const _onSetAccountIndex = useCallback((value: number) => setAccountIndex(Number(value)), []);
  const _onSetAddressOffset = useCallback((value: number) => setAddressOffset(Number(value)), []);

  return (
    <>
      <Header
        showBackArrow
        text={t<string>('Import Ledger Account')}
      />
      <div className={className}>
        <Address
          address={address}
          genesisHash={genesis}
          isExternal
          isHardware
          name={name}
        />
        <Dropdown
          className='network'
          label={t<string>('Network')}
          onChange={setGenesis}
          options={networkOps.current}
          value={genesis}
        />
        <InputWithLabel label="Custom Genesis" defaultValue="" value={custom} onChange={setCustom}/>
        { !!genesis && !!address && !ledgerError && (
          <Name
            onChange={setName}
            value={name || ''}
          />
        )}
        { !!name && (
          <>
            <Dropdown
              className='accountType'
              isDisabled={ledgerLoading}
              label={t<string>('account type')}
              onChange={_onSetAccountIndex}
              options={accOps.current}
              value={accountIndex}
            />
            <Dropdown
              className='accountIndex'
              isDisabled={ledgerLoading}
              label={t<string>('address index')}
              onChange={_onSetAddressOffset}
              options={addOps.current}
              value={addressOffset}
            />
          </>
        )}
        {!!ledgerWarning && (
          <Warning>
            {ledgerWarning}
          </Warning>
        )}
        {(!!error || !!ledgerError) && (
          <Warning
            isDanger
          >
            {error || ledgerError}
          </Warning>
        )}
      </div>
      <VerticalSpace/>
      <ButtonArea>
        {ledgerLocked
          ? (
            <Button
              isBusy={ledgerLoading || isBusy}
              onClick={refresh}
            >
              <FontAwesomeIcon icon={faSync} />
              {t<string>('Refresh')}
            </Button>
          )
          : (
            <Button
              isBusy={ledgerLoading || isBusy}
              isDisabled={!!error || !!ledgerError || !address || !genesis}
              onClick={_onSave}
            >
              {t<string>('Import Account')}
            </Button>
          )
        }
      </ButtonArea>
    </>
  );
}

export default styled(ImportLedger)`
  .refreshIcon {
    margin-right: 0.3rem;
  }
`;
