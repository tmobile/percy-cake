export interface Configuration {
    default: object;
    environments?: object;
}

export interface ConfigFile {
  fileName: string;
  applicationName: string;
  size?: number;
  modified?: boolean; // Means this is a modified file compared to repo, able to commit
  draftConfig?: Configuration;
  originalConfig?: Configuration;
}
