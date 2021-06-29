declare module "@ledgerhq/hw-transport-http/lib/HttpTransport" {
  import Transport from "@ledgerhq/hw-transport";

  export default class HttpTransport extends Transport<string> {}
}

declare module "@ledgerhq/hw-transport-node-speculos" {
  export type SpeculosTransportOpts = {
    apduPort: number;
    buttonPort?: number;
    automationPort?: number;
    host?: string;
  };

  import Transport from "@ledgerhq/hw-transport";
  export default class SpeculosTransport extends Transport<SpeculosTransportOpts> {}
}
