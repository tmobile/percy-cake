import { TreeNode } from "./tree-node";

export class Configuration extends TreeNode {
    default: TreeNode;
    environments: TreeNode;

    constructor(root?: TreeNode) {
      super('');

      this.default = root ? root.findChild(['default']) : null;
      this.environments = root ? root.findChild(['environments']) : null;

      if (!this.default || this.default.valueType !== 'object') {
        this.default = new TreeNode('default');
      }

      if (!this.environments || this.environments.valueType !== 'object') {
        this.environments = new TreeNode('environments');
      }

      // Make them as root
      this.default.parent = undefined;
      this.environments.parent = undefined;

      this.children = [];
      this.children.push(this.default);
      this.children.push(this.environments);
    }
}

export interface ConfigFile {
  fileName: string;
  applicationName: string;
  size?: number;
  modified?: boolean; // Means this is a modified file compared to repo, able to commit
  draftConfig?: Configuration;
  originalConfig?: Configuration;
  oid?: string; // File SHA oid
}
