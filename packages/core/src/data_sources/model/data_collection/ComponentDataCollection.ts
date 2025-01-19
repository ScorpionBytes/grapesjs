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

    const collectionDef = props[keyCollectionDefinition];
    if (!collectionDef) {
      em.logError('missing collection definition');

      return cmp;
    }

    const parentCollectionStateMap = (props[keyCollectionsStateMap] || {}) as DataCollectionStateMap;

    const components: Component[] = getCollectionItems(em, collectionDef, parentCollectionStateMap, opt);

    if (this.hasDynamicDataSource()) {
      this.watchDataSource(em, collectionDef, parentCollectionStateMap, opt);
    }
    cmp.components(components);

    return cmp;
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === CollectionComponentType;
  }

  hasDynamicDataSource() {
    const dataSource = this.get(keyCollectionDefinition).collectionConfig.dataSource;
    return typeof dataSource === 'object' && dataSource.type === DataVariableType;
  }

  toJSON(opts?: ObjectAny) {
    const json = super.toJSON(opts) as ComponentDataCollectionDefinition;

    const firstChild = this.getBlockDefinition();
    json[keyCollectionDefinition].componentDef = firstChild;

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
    collectionDef: DataCollectionDefinition,
    parentCollectionStateMap: DataCollectionStateMap,
    opt: ComponentOptions,
  ) {
    const path = this.get(keyCollectionDefinition).collectionConfig.dataSource?.path;
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
        const collectionItems = getCollectionItems(em, collectionDef, parentCollectionStateMap, opt);
        this.components(collectionItems);
      },
    });
  }
}

function getCollectionItems(
  em: EditorModel,
  collectionDef: DataCollectionDefinition,
  parentCollectionStateMap: DataCollectionStateMap,
  opt: ComponentOptions,
) {
  const { componentDef, collectionConfig } = collectionDef;
  if (!collectionConfig) {
    em.logError('The "collectionConfig" property is required in the collection definition.');
    return [];
  }

  if (!componentDef) {
    em.logError('The "componentDef" property is required in the collection definition.');
    return [];
  }

  if (!collectionConfig?.dataSource) {
    em.logError('The "collectionConfig.dataSource" property is required in the collection definition.');
    return [];
  }

  const collectionId = collectionConfig.collectionId;

  const components: Component[] = [];

  let items: any[] = getDataSourceItems(collectionConfig.dataSource, em);
  const startIndex = Math.max(0, collectionConfig.startIndex || 0);
  const endIndex = Math.min(
    items.length - 1,
    collectionConfig.endIndex !== undefined ? collectionConfig.endIndex : Number.MAX_VALUE,
  );

  const totalItems = endIndex - startIndex + 1;
  let blockSymbolMain: Component;
  for (let index = startIndex; index <= endIndex; index++) {
    const item = items[index];
    const collectionState: DataCollectionState = {
      collectionId,
      currentIndex: index,
      currentItem: item,
      startIndex: startIndex,
      endIndex: endIndex,
      totalItems: totalItems,
      remainingItems: totalItems - (index + 1),
    };

    const collectionsStateMap: DataCollectionStateMap = {
      ...parentCollectionStateMap,
      ...(collectionId && { [collectionId]: collectionState }),
      [keyInnerCollectionState]: collectionState,
    };

    if (index === startIndex) {
      // @ts-ignore
      const type = em.Components.getType(componentDef?.type || 'default');
      const model = type.model;

      blockSymbolMain = new model(
        {
          ...componentDef,
          [keyCollectionsStateMap]: collectionsStateMap,
          [keyIsCollectionItem]: true,
          draggable: false,
        },
        opt,
      );
      blockSymbolMain!.setSymbolOverride([keyCollectionsStateMap]);
    }
    blockSymbolMain!.set(keyCollectionsStateMap, collectionsStateMap);
    const instance = blockSymbolMain!.clone({ symbol: true });
    setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(instance);

    components.push(instance);
  }

  return components;
}

function setCollectionStateMapAndPropagate(
  collectionsStateMap: DataCollectionStateMap,
  collectionId: string | undefined,
) {
  return (model: Component) => {
    setCollectionStateMap(collectionsStateMap)(model);

    // Listener function for the 'add' event
    const addListener = (component: Component) => {
      setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(component);
    };

    // Generate a unique listener key
    const listenerKey = `_hasAddListener${collectionId ? `_${collectionId}` : ''}`;

    // Add the 'add' listener if not already in the listeners array
    if (!model.collectionStateListeners.includes(listenerKey)) {
      model.listenTo(model.components(), 'add', addListener);
      model.collectionStateListeners.push(listenerKey);

      // Add a 'remove' listener to clean up
      model.listenTo(model.components(), 'remove', () => {
        model.stopListening(model.components(), 'add', addListener); // Remove the 'add' listener
        const index = model.collectionStateListeners.indexOf(listenerKey);
        if (index > -1) {
          model.collectionStateListeners.splice(index, 1); // Remove the listener key
        }
      });
    }

    // Recursively apply to all child components
    model
      .components()
      ?.toArray()
      .forEach((component: Component) => {
        setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(component);
      });
  };
}

function setCollectionStateMap(collectionsStateMap: DataCollectionStateMap) {
  return (cmp: Component) => {
    cmp.set(keyIsCollectionItem, true);
    cmp.set(keyCollectionsStateMap, {
      ...cmp.get(keyCollectionsStateMap),
      ...collectionsStateMap,
    });
  };
}

function getDataSourceItems(dataSource: any, em: EditorModel) {
  let items: any[] = [];
  switch (true) {
    case isArray(dataSource):
      items = dataSource;
      break;
    case typeof dataSource === 'object' && dataSource instanceof DataSource: {
      const id = dataSource.get('id')!;
      items = listDataSourceVariables(id, em);
      break;
    }
    case typeof dataSource === 'object' && dataSource.type === DataVariableType: {
      const isDataSourceId = dataSource.path.split('.').length === 1;
      if (isDataSourceId) {
        const id = dataSource.path;
        items = listDataSourceVariables(id, em);
      } else {
        // Path points to a record in the data source
        items = em.DataSources.getValue(dataSource.path, []);
      }
      break;
    }
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
