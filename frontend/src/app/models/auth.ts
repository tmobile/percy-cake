
export interface Repo {
  repositoryUrl: string;
  branchName: string;
}

export interface Authenticate extends Repo {
  username: string;
  password?: string;
}

export interface User extends Authenticate {
  repoName: string;
  repoFolder: string;
  token: string;
  validUntil: number;
}
