import { isArray } from 'underscore';
import Component from '../../../dom_components/model/Component';
import { ComponentDefinition, ComponentOptions, ComponentProperties } from '../../../dom_components/model/types';
import { toLowerCase } from '../../../utils/mixins';
import { ConditionDefinition } from '../conditional_variables/DataCondition';
import DataSource from '../DataSource';
import { DataVariableType } from '../DataVariable';
import { ObjectAny } from '../../../common';

export const CollectionVariableType = 'collection-component';
// Represents the type for defining a loop’s data source.
type CollectionDataSource =
  | any[]  // Direct array
  | { type: 'datasource-variable'; path: string }  // Object representing a data source
  | { type: 'parent-collection-variable'; path: string };  // Object representing an outer loop variable

// Defines the collection's configuration, such as start and end indexes, and data source.
interface CollectionConfig {
  start_index?: number;  // The starting index for the collection
  end_index?: number | ConditionDefinition;  // End index; can be absolute or relative (If omitted will loop over all items)
  dataSource: CollectionDataSource;  // The data source (array or object reference)
}

// Provides access to collection state variables during iteration.
interface CollectionStateVariables {
  current_index: number;  // Current collection index
  start_index: number;  // Start index
  current_item: any;  // Current item in the iteration
  end_index: number;  // End index
  collection_name?: string;  // Optional name of the collection
  total_items: number;  // Total number of items in the collection
  remaining_items: number; // Remaining items in the collection
}

// Defines the complete structure for a collection, including configuration and state variables.
interface CollectionDefinition {
  type: typeof CollectionVariableType;
  collection_name?: string;  // Optional collection name
  config: CollectionConfig;  // Loop configuration details
  block: ComponentDefinition;  // Component definition for each iteration
}
export const componentCollectionKey = 'collectionsItems';

export default class CollectionComponent extends Component {
  constructor(props: CollectionDefinition & ComponentProperties, opt: ComponentOptions) {
    const { collection_name, block, config } = props.collectionDefinition;
    const {
      start_index = 0,
      end_index = Number.MAX_VALUE,
      dataSource = [],
    } = config;
    let items: any[] = [];
    switch (true) {
      case isArray(dataSource):
        items = dataSource;
        break;
      case typeof dataSource === 'object' && dataSource instanceof DataSource:
        const id = dataSource.get('id')!;
        const resolvedPath = opt.em.DataSources.getValue(id, []);
        const keys = Object.keys(resolvedPath);
        items = keys.map(key => ({
          type: DataVariableType,
          path: id + '.' + key,
        }));
        break;
      case typeof dataSource === 'object' && dataSource.type === DataVariableType:
        const pathArr = dataSource.path.split('.');
        if (pathArr.length === 1) {
          const resolvedPath = opt.em.DataSources.getValue(dataSource.path, []);
          const keys = Object.keys(resolvedPath);
          items = keys.map(key => ({
            type: DataVariableType,
            path: id + '.' + key,
          }));
        } else {
          items = opt.em.DataSources.getValue(dataSource.path, []);
        }
        break;
      default:
    }

    const components: ComponentDefinition[] = [];
    const resolvedStartIndex = Math.max(0, start_index);
    const resolvedEndIndex = Math.min(items.length - 1, end_index);
    const item = items[resolvedStartIndex];
    let symbolMain;
    const total_items = resolvedEndIndex - resolvedStartIndex + 1;
    const innerMostCollectionItem = {
      collection_name,
      current_index: resolvedStartIndex,
      current_item: item,
      start_index: resolvedStartIndex,
      end_index: resolvedEndIndex,
      total_items: total_items,
      remaining_items: total_items - (resolvedStartIndex + 1),
    };

    const allCollectionItem = {
      ...props.collectionsItems,
      [innerMostCollectionItem.collection_name ? innerMostCollectionItem.collection_name : 'innerMostCollectionItem']:
        innerMostCollectionItem,
      innerMostCollectionItem
    }
    const { clonedBlock, overrideKeys } = resolveBlockValues(allCollectionItem, block);
    const type = opt.em.Components.getType(clonedBlock?.type || 'default');
    const model = type.model;
    const symbol = new model(clonedBlock, opt);
    symbolMain = opt.em.Components.addSymbol(symbol);

    for (let index = resolvedStartIndex; index <= resolvedEndIndex; index++) {
      const item = items[index];
      const innerMostCollectionItem = {
        collection_name,
        current_index: index,
        current_item: item,
        start_index: resolvedStartIndex,
        end_index: resolvedEndIndex,
        total_items: total_items,
        remaining_items: total_items - (index + 1),
      };

      const allCollectionItem = {
        ...props.collectionsItems,
        [innerMostCollectionItem.collection_name ? innerMostCollectionItem.collection_name : 'innerMostCollectionItem']:
          innerMostCollectionItem,
        innerMostCollectionItem
      }
      const { overrideKeys } = resolveBlockValues(allCollectionItem, block);
      const instance = opt.em.Components.addSymbol(symbolMain!);
      const children: any[] = []
      Object.keys(overrideKeys).length && instance!.setSymbolOverride(Object.keys(overrideKeys));
      instance!.set(overrideKeys);
      for (let i = 0; i < instance!.components().length; i++) {
        const childBlock = block['components'][i];
        const { overrideKeys } = resolveBlockValues(allCollectionItem, deepCloneObject(childBlock));
        const child = opt.em.Components.addSymbol(symbolMain!.components().at(i))
        Object.keys(overrideKeys).length && child!.setSymbolOverride(Object.keys(overrideKeys));
        child!.set(overrideKeys)
        children.push(child);
      }

      const componentJSON = instance?.toJSON();
      const cmpDefinition = {
        ...componentJSON,
        components: children
      };

      components.push(cmpDefinition);
    }

    const conditionalCmptDef = {
      ...props,
      type: CollectionVariableType,
      components: components,
      dropbbable: false,
    };
    // @ts-expect-error
    super(conditionalCmptDef, opt);
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === CollectionVariableType;
  }
}

/**
 * Deeply clones an object.
 * @template T The type of the object to clone.
 * @param {T} obj The object to clone.
 * @returns {T} A deep clone of the object, or the original object if it's not an object or is null. Returns undefined if input is undefined.
 */
function deepCloneObject<T extends Record<string, any> | null | undefined>(obj: T): T {
  if (obj === null) return null as T;
  if (obj === undefined) return undefined as T;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return obj; // Return primitives directly
  }

  const clonedObj: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepCloneObject(obj[key]);
    }
  }

  return clonedObj as T;
}

function resolveBlockValues(context: any, block: any) {
  const { innerMostCollectionItem } = context;
  const clonedBlock = deepCloneObject(block);
  const overrideKeys: ObjectAny = {};

  if (typeof clonedBlock === 'object' && clonedBlock !== null) {
    const blockKeys = Object.keys(clonedBlock);

    for (const key of blockKeys) {
      let blockValue = clonedBlock[key];
      if (key === 'collectionDefinition') continue;
      let shouldBeOverridden = false;

      if (typeof blockValue === 'object' && blockValue !== null) {
        const collectionItem = blockValue.collection_name
          ? context[blockValue.collection_name]
          : innerMostCollectionItem;
        if (blockValue.type === 'parent-collection-variable') {
          if (!collectionItem) {
            throw new Error(
              `Collection not found: ${blockValue.collection_name || 'default collection'}`
            );
          }

          if (blockValue.variable_type === 'current_item') {
            if (collectionItem.current_item.type === DataVariableType) {
              const path = collectionItem.current_item.path ? `${collectionItem.current_item.path}.${blockValue.path}` : blockValue.path;
              clonedBlock[key] = {
                ...collectionItem.current_item,
                path
              };
            }
          } else {
            clonedBlock[key] = collectionItem[blockValue.variable_type];
          }

          shouldBeOverridden = true;
        } else if (Array.isArray(blockValue)) {
          // Resolve each item in the array
          clonedBlock[key] = blockValue.map((arrayItem: any) => {
            const { clonedBlock, overrideKeys: itemOverrideKeys } = resolveBlockValues(context, arrayItem)
            if (Object.keys(itemOverrideKeys).length > 0) {
              shouldBeOverridden = true;
            }
            return typeof arrayItem === 'object' ? clonedBlock : arrayItem
          });
        } else {
          const { clonedBlock, overrideKeys: itemOverrideKeys } = resolveBlockValues(context, blockValue).clonedBlock;
          clonedBlock[key] = clonedBlock;

          if (Object.keys(itemOverrideKeys).length > 0) {
            shouldBeOverridden = true;
          }
        }

        if (shouldBeOverridden && key !== 'components') {
          overrideKeys[key] = clonedBlock[key]
        }
      }
    }
  }

  return { clonedBlock, overrideKeys };
}
