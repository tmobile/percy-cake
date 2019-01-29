export interface Repo {
  repositoryUrl: string;
}

export interface Authenticate extends Repo {
  username: string;
  password?: string;
}

export interface User extends Authenticate {
  branchName: string;
  repoName: string;
  repoFolder: string;
  token: string;
}

export interface RepoMetadata extends User {
  version: string;
  commitBaseSHA: { [branchName: string]: { [filePath: string]: string } };
}

export interface Principal {
  user: User;
  repoMetadata: RepoMetadata;
}
