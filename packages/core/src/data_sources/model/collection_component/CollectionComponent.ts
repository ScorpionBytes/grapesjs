import DataVariable, { DataVariableType } from './../DataVariable';
import { isArray } from 'underscore';
import Component, { keySymbol, keySymbolOvrd, keySymbols } from '../../../dom_components/model/Component';
import { ComponentDefinition, ComponentOptions, ComponentProperties } from '../../../dom_components/model/types';
import { toLowerCase } from '../../../utils/mixins';
import DataSource from '../DataSource';
import { ObjectAny } from '../../../common';
import EditorModel from '../../../editor/model/Editor';
import { keyCollectionsStateMap } from '../../../dom_components/model/Component';
import { CollectionComponentDefinition, CollectionDefinition, CollectionState, CollectionsStateMap } from './types';
import { keyCollectionDefinition, keyInnerCollectionState, CollectionComponentType } from './constants';
import DynamicVariableListenerManager from '../DataVariableListenerManager';

export default class CollectionComponent extends Component {
  constructor(props: CollectionComponentDefinition, opt: ComponentOptions) {
    const em = opt.em;
    const collectionDefinition = props[keyCollectionDefinition];
    const parentCollectionStateMap = (props[keyCollectionsStateMap] || {}) as CollectionsStateMap;

    const components: ComponentDefinition[] = getCollectionItems(
      em,
      collectionDefinition,
      parentCollectionStateMap,
      opt,
    );

    const conditionalCmptDef = {
      ...props,
      type: CollectionComponentType,
      components: components,
      dropbbable: false,
    };

    // @ts-ignore
    super(conditionalCmptDef, opt);

    if (this.hasDynamicDataSource()) {
      const path = this.get(keyCollectionDefinition).config.dataSource?.path;
      new DynamicVariableListenerManager({
        em: em,
        dataVariable: new DataVariable(
          {
            type: 'data-variable',
            path,
          },
          { em },
        ),
        updateValueFromDataVariable: () => {
          const collectionItems = getCollectionItems(em, collectionDefinition, parentCollectionStateMap, opt);
          this.components(collectionItems);
        },
      });
    }
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === CollectionComponentType;
  }

  hasDynamicDataSource() {
    const dataSource = this.get(keyCollectionDefinition).config.dataSource;
    return typeof dataSource === 'object' && dataSource.type === DataVariableType;
  }

  toJSON(opts?: ObjectAny) {
    const json = super.toJSON(opts) as CollectionComponentDefinition;

    const firstChild = this.components().at(0)?.toJSON() || {};
    const keysToRemove = ['attributes?.id', keySymbol, keySymbols, keySymbolOvrd, keyCollectionsStateMap];
    keysToRemove.forEach((key) => delete firstChild[key]);
    json[keyCollectionDefinition].block = firstChild;

    delete json.components;
    return json;
  }
}

function getCollectionItems(
  em: EditorModel,
  collectionDefinition: CollectionDefinition,
  parentCollectionStateMap: CollectionsStateMap,
  opt: ComponentOptions,
) {
  const { collection_name, block, config } = collectionDefinition;
  if (!block) {
    em.logError('The "block" property is required in the collection definition.');
    return [];
  }

  if (!config?.dataSource) {
    em.logError('The "config.dataSource" property is required in the collection definition.');
    return [];
  }

  const components: ComponentDefinition[] = [];

  let items: any[] = getDataSourceItems(config.dataSource, em);
  const start_index = Math.max(0, config.start_index || 0);
  const end_index = Math.min(items.length - 1, config.end_index || Number.MAX_VALUE);

  const total_items = end_index - start_index + 1;
  let blockComponent: Component;
  for (let index = start_index; index <= end_index; index++) {
    const item = items[index];
    const collectionState: CollectionState = {
      collection_name,
      current_index: index,
      current_item: item,
      start_index: start_index,
      end_index: end_index,
      total_items: total_items,
      remaining_items: total_items - (index + 1),
    };

    const collectionsStateMap: CollectionsStateMap = {
      ...parentCollectionStateMap,
      ...(collection_name && { [collection_name]: collectionState }),
      [keyInnerCollectionState]: collectionState,
    };

    if (index === start_index) {
      // @ts-ignore
      const type = em.Components.getType(block?.type || 'default');
      const model = type.model;
      blockComponent = new model(
        {
          ...block,
          [keyCollectionsStateMap]: collectionsStateMap,
        },
        opt,
      );
    }
    const instance = em.Components.addSymbol(blockComponent!);
    const cmpDefinition = resolveComponent(instance!, block, collectionsStateMap, em);

    components.push(cmpDefinition);
  }

  return components;
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

function resolveComponent(
  component: Component,
  block: ComponentDefinition,
  collectionsStateMap: CollectionsStateMap,
  em: EditorModel,
) {
  // @ts-ignore
  component!.set(block);

  const children: ComponentDefinition[] = [];
  for (let index = 0; index < component!.components().length; index++) {
    const childSymbol = component!.components().at(index);
    const childBlock = block['components']![index];
    const childJSON = resolveComponent(childSymbol, childBlock, collectionsStateMap, em);
    children.push(childJSON);
  }

  const componentJSON = component!.toJSON();
  const componentDefinition: ComponentDefinition = {
    ...componentJSON,
    components: children,
    [keyCollectionsStateMap]: collectionsStateMap,
  };

  return componentDefinition;
}
