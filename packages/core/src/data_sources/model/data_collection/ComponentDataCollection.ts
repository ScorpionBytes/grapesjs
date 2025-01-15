import DataVariable, { DataVariableType } from '../DataVariable';
import { isArray } from 'underscore';
import Component from '../../../dom_components/model/Component';
import { ComponentOptions } from '../../../dom_components/model/types';
import { toLowerCase } from '../../../utils/mixins';
import DataSource from '../DataSource';
import { ObjectAny } from '../../../common';
import EditorModel from '../../../editor/model/Editor';
import { keyCollectionsStateMap } from '../../../dom_components/model/Component';
import {
  ComponentDataCollectionDefinition,
  DataCollectionDefinition,
  DataCollectionState,
  DataCollectionStateMap,
} from './types';
import {
  keyCollectionDefinition,
  keyInnerCollectionState,
  CollectionComponentType,
  keyIsCollectionItem,
} from './constants';
import DynamicVariableListenerManager from '../DataVariableListenerManager';

export default class ComponentDataCollection extends Component {
  constructor(props: ComponentDataCollectionDefinition, opt: ComponentOptions) {
    const em = opt.em;
    // @ts-ignore
    const cmp: ComponentDataCollection = super(
      // @ts-ignore
      {
        ...props,
        components: undefined,
        droppable: false,
      },
      opt,
    );

    const collectionDefinition = props[keyCollectionDefinition];
    if (!collectionDefinition) {
      em.logError('missing collection definition');

      return cmp;
    }

    const parentCollectionStateMap = (props[keyCollectionsStateMap] || {}) as DataCollectionStateMap;

    const components: Component[] = getCollectionItems(em, collectionDefinition, parentCollectionStateMap, opt);

    if (this.hasDynamicDataSource()) {
      this.watchDataSource(em, collectionDefinition, parentCollectionStateMap, opt);
    }
    cmp.components(components);

    return cmp;
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === CollectionComponentType;
  }

  hasDynamicDataSource() {
    const dataSource = this.get(keyCollectionDefinition).config.dataSource;
    return typeof dataSource === 'object' && dataSource.type === DataVariableType;
  }

  toJSON(opts?: ObjectAny) {
    const json = super.toJSON(opts) as ComponentDataCollectionDefinition;

    const firstChild = this.getBlockDefinition();
    json[keyCollectionDefinition].block = firstChild;

    delete json.components;
    delete json.droppable;
    return json;
  }

  private getBlockDefinition() {
    const firstChild = this.components().at(0)?.toJSON() || {};
    delete firstChild.draggable;

    return firstChild;
  }

  private watchDataSource(
    em: EditorModel,
    collectionDefinition: DataCollectionDefinition,
    parentCollectionStateMap: DataCollectionStateMap,
    opt: ComponentOptions,
  ) {
    const path = this.get(keyCollectionDefinition).config.dataSource?.path;
    const dataVariable = new DataVariable(
      {
        type: DataVariableType,
        path,
      },
      { em },
    );
    new DynamicVariableListenerManager({
      em: em,
      dataVariable,
      updateValueFromDataVariable: () => {
        const collectionItems = getCollectionItems(em, collectionDefinition, parentCollectionStateMap, opt);
        this.components(collectionItems);
      },
    });
  }
}

function getCollectionItems(
  em: EditorModel,
  collectionDefinition: DataCollectionDefinition,
  parentCollectionStateMap: DataCollectionStateMap,
  opt: ComponentOptions,
) {
  const { collectionName, block, config } = collectionDefinition;
  if (!block) {
    em.logError('The "block" property is required in the collection definition.');
    return [];
  }

  if (!config?.dataSource) {
    em.logError('The "config.dataSource" property is required in the collection definition.');
    return [];
  }

  const components: Component[] = [];

  let items: any[] = getDataSourceItems(config.dataSource, em);
  const startIndex = Math.max(0, config.startIndex || 0);
  const endIndex = Math.min(items.length - 1, config.endIndex !== undefined ? config.endIndex : Number.MAX_VALUE);

  const totalItems = endIndex - startIndex + 1;
  let blockSymbolMain: Component;
  for (let index = startIndex; index <= endIndex; index++) {
    const item = items[index];
    const collectionState: DataCollectionState = {
      collectionName,
      currentIndex: index,
      currentItem: item,
      startIndex: startIndex,
      endIndex: endIndex,
      totalItems: totalItems,
      remainingItems: totalItems - (index + 1),
    };

    const collectionsStateMap: DataCollectionStateMap = {
      ...parentCollectionStateMap,
      ...(collectionName && { [collectionName]: collectionState }),
      [keyInnerCollectionState]: collectionState,
    };

    if (index === startIndex) {
      // @ts-ignore
      const type = em.Components.getType(block?.type || 'default');
      const model = type.model;

      blockSymbolMain = new model(
        {
          ...block,
          [keyCollectionsStateMap]: collectionsStateMap,
          [keyIsCollectionItem]: true,
          draggable: false,
          deepPropagate: [setCollectionStateMap(collectionsStateMap)],
        },
        opt,
      );
      blockSymbolMain!.setSymbolOverride([keyCollectionsStateMap]);
    }
    blockSymbolMain!.set(keyCollectionsStateMap, collectionsStateMap);
    const instance = blockSymbolMain!.clone({ symbol: true });

    components.push(instance);
  }

  return components;
}

function setCollectionStateMap(collectionsStateMap: DataCollectionStateMap) {
  return (cmp: Component) => {
    cmp.set(keyIsCollectionItem, true);
    cmp.set(keyCollectionsStateMap, collectionsStateMap);
  };
}

function getDataSourceItems(dataSource: any, em: EditorModel) {
  let items: any[] = [];
  switch (true) {
    case isArray(dataSource):
      items = dataSource;
      break;
    case typeof dataSource === 'object' && dataSource instanceof DataSource:
      const id = dataSource.get('id')!;
      items = listDataSourceVariables(id, em);
      break;
    case typeof dataSource === 'object' && dataSource.type === DataVariableType:
      const isDataSourceId = dataSource.path.split('.').length === 1;
      if (isDataSourceId) {
        const id = dataSource.path;
        items = listDataSourceVariables(id, em);
      } else {
        // Path points to a record in the data source
        items = em.DataSources.getValue(dataSource.path, []);
      }
      break;
    default:
  }
  return items;
}

function listDataSourceVariables(dataSource_id: string, em: EditorModel) {
  const records = em.DataSources.getValue(dataSource_id, []);
  const keys = Object.keys(records);

  return keys.map((key) => ({
    type: DataVariableType,
    path: dataSource_id + '.' + key,
  }));
}
