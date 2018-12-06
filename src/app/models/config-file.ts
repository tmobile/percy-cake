import { PROPERTY_VALUE_TYPES } from 'config';
import { TreeNode } from './tree-node';

/**
 * Represents yaml configuration. It contains a 'default' tree and a 'environments' tree.
 */
export class Configuration extends TreeNode {

  default: TreeNode;
  environments: TreeNode;

  /**
   * Create configuration from tree node.
   * @param root the root tree node
   * @returns new configuration
   */
  static fromTreeNode(root?: TreeNode) {
    return new Configuration(root ? root.findChild(['default']) : null, root ? root.findChild(['environments']) : null);
  }

  /**
   * Constructor with 'default' tree and 'environments' tree
   * @param _default the 'default' tree
   * @param _environments the 'environments' tree
   */
  constructor(_default?: TreeNode, _environments?: TreeNode) {
    super('');

    this.default = _default;
    this.environments = _environments;

    if (!this.default || this.default.valueType !== PROPERTY_VALUE_TYPES.OBJECT) {
      this.default = new TreeNode('default');
    }

    if (!this.environments || this.environments.valueType !== PROPERTY_VALUE_TYPES.OBJECT) {
      this.environments = new TreeNode('environments');
    }

    // Make them as root
    // (In yaml file, they are not root; But in editor view, they are displayed in separate tree, and thus is root)
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
