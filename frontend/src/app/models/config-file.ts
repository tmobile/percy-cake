export interface Configuration {
    default: object;
    environments?: object;
}

export interface ConfigFile {
  fileName: string;
  applicationName: string;
  timestamp?: number;
  size?: number;
  modified?: boolean;
  draftConfig?: Configuration;
  originalConfig?: Configuration;
}
