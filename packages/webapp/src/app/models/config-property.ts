import { TreeNode } from './tree-node';

/**
 * Interface that describes the config property for add/edit
 */
export interface ConfigProperty {
  editMode: boolean;
  envFileMode?: boolean;
  keyOptions: { key: string, type: string }[];
  node: TreeNode; // When in edit mode, this is node being edited; when in add mode, this is the parent node being added to
  defaultTree: TreeNode; // The 'default' root tree
}
