export interface Repo {
  repositoryUrl: string;
  branchName: string;
}

export interface Authenticate extends Repo {
  username: string;
  password: string;
}

export interface LoginResult extends Repo {
    token: string;
    repoName: string;
    validUntil: string;
    envFileName: string;
}

export interface User extends LoginResult {
    username: string;
}
