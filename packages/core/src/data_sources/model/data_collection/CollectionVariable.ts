import { DataCollectionVariableDefinition } from './types';
import { Model } from '../../../common';
import EditorModel from '../../../editor/model/Editor';
import DataVariable, { DataVariableType } from '../DataVariable';
import { keyInnerCollectionState } from './constants';
import { DataCollectionState, DataCollectionStateMap } from './types';

export default class CollectionVariable extends Model<DataCollectionVariableDefinition> {
  em: EditorModel;
  collectionsStateMap: DataCollectionStateMap;
  dataVariable?: DataVariable;

  constructor(
    attrs: DataCollectionVariableDefinition,
    options: {
      em: EditorModel;
      collectionsStateMap: DataCollectionStateMap;
    },
  ) {
    super(attrs, options);
    this.em = options.em;
    this.collectionsStateMap = options.collectionsStateMap;

    this.updateDataVariable();
  }

  hasDynamicValue() {
    return !!this.dataVariable;
  }

  getDataValue() {
    const { resolvedValue } = this.updateDataVariable();

    if (resolvedValue?.type === DataVariableType) {
      return this.dataVariable!.getDataValue();
    }
    return resolvedValue;
  }

  private updateDataVariable() {
    const resolvedValue = resolveCollectionVariable(
      this.attributes as DataCollectionVariableDefinition,
      this.collectionsStateMap,
      this.em,
    );

    let dataVariable;
    if (resolvedValue?.type === DataVariableType) {
      dataVariable = new DataVariable(resolvedValue, { em: this.em });
      this.dataVariable = dataVariable;
    }

    return { resolvedValue, dataVariable };
  }

  destroy() {
    return this.dataVariable?.destroy?.() || super.destroy();
  }
}

function resolveCollectionVariable(
  collectionVariableDefinition: DataCollectionVariableDefinition,
  collectionsStateMap: DataCollectionStateMap,
  em: EditorModel,
) {
  const { collectionName = keyInnerCollectionState, variableType, path } = collectionVariableDefinition;
  if (!collectionsStateMap) return;

  const collectionItem = collectionsStateMap[collectionName];

  if (!collectionItem) {
    em.logError(`Collection not found: ${collectionName}`);
    return '';
  }

  if (!variableType) {
    em.logError(`Missing collection variable type for collection: ${collectionName}`);
    return '';
  }

  if (variableType === 'currentItem') {
    return resolveCurrentItem(collectionItem, path, collectionName, em);
  }

  return collectionItem[variableType];
}

function resolveCurrentItem(
  collectionItem: DataCollectionState,
  path: string | undefined,
  collectionName: string,
  em: EditorModel,
) {
  const currentItem = collectionItem.currentItem;

  if (!currentItem) {
    em.logError(`Current item is missing for collection: ${collectionName}`);
    return '';
  }

  if (currentItem.type === DataVariableType) {
    const resolvedPath = currentItem.path ? `${currentItem.path}.${path}` : path;
    return {
      ...currentItem,
      path: resolvedPath,
    };
  }

  if (path && !currentItem[path]) {
    em.logError(`Path not found in current item: ${path} for collection: ${collectionName}`);
    return '';
  }

  return path ? currentItem[path] : currentItem;
}
