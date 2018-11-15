/**
 * Class that describes the config property for add/edit
 */
export class ConfigProperty {
    key: string;
    value: any;
    valueType: string;
    comment?: string;
    level: number;
    isDefaultNode: boolean; // represents if property is default or not, false means it is environments root node
}
