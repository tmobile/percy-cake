import { TreeNode } from "./tree-node";

export class Configuration extends TreeNode {
    default: TreeNode;
    environments: TreeNode;

    static fromTreeNode(root?: TreeNode) {
      return new Configuration(root ? root.findChild(['default']) : null, root ? root.findChild(['environments']) : null);
    }
    constructor(_default?: TreeNode, _environments?: TreeNode) {
      super('');

      this.default = _default;
      this.environments = _environments;

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
