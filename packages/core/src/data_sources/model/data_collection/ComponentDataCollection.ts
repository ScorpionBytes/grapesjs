import { isArray } from 'underscore';
import { ObjectAny } from '../../../common';
import Component from '../../../dom_components/model/Component';
import { ComponentDefinition, ComponentDefinitionDefined, ComponentOptions } from '../../../dom_components/model/types';
import EditorModel from '../../../editor/model/Editor';
import { isObject, toLowerCase } from '../../../utils/mixins';
import DataSource from '../DataSource';
import DataVariable, { DataVariableProps, DataVariableType } from '../DataVariable';
import DynamicVariableListenerManager from '../DataVariableListenerManager';
import { DataCollectionType, keyCollectionDefinition, keyCollectionsStateMap, keyIsCollectionItem } from './constants';
import {
  ComponentDataCollectionProps,
  DataCollectionConfig,
  DataCollectionDataSource,
  DataCollectionProps,
  DataCollectionState,
  DataCollectionStateMap,
} from './types';
import { isDataVariable } from '../utils';

export default class ComponentDataCollection extends Component {
  constructor(props: ComponentDataCollectionProps, opt: ComponentOptions) {
    const collectionDef = props[keyCollectionDefinition];
    if (opt.forCloning) {
      // If we are cloning, leave setting the collection items to the main symbol collection
      return super(props as any, opt) as unknown as ComponentDataCollection;
    }

    const em = opt.em;
    const cmp: ComponentDataCollection = super(
      {
        ...props,
        components: undefined,
        droppable: false,
      } as any,
      opt,
    ) as unknown as ComponentDataCollection;

    if (!collectionDef) {
      em.logError('missing collection definition');

      return cmp;
    }

    const parentCollectionStateMap = (props[keyCollectionsStateMap] || {}) as DataCollectionStateMap;

    const components: Component[] = getCollectionItems(em, collectionDef, parentCollectionStateMap, opt);
    cmp.components(components, opt);

    if (isDataVariable(this.collectionDataSource)) {
      this.watchDataSource(parentCollectionStateMap, opt);
    }

    return cmp;
  }

  get collectionConfig() {
    return this.get(keyCollectionDefinition).collectionConfig as DataCollectionConfig;
  }

  get collectionDataSource() {
    return this.collectionConfig.dataSource;
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === DataCollectionType;
  }

  toJSON(opts?: ObjectAny) {
    const json = super.toJSON.call(this, opts) as ComponentDataCollectionProps;
    json[keyCollectionDefinition].componentDef = this.getComponentDef();

    delete json.components;
    delete json.droppable;
    return json;
  }

  private getComponentDef() {
    const firstChild = this.components().at(0);

    const firstChildJSON = firstChild ? this.deepToJSON(firstChild) : this.get(keyCollectionDefinition).componentDef;
    delete firstChildJSON?.draggable;

    return firstChildJSON;
  }

  private watchDataSource(parentCollectionStateMap: DataCollectionStateMap, opt: ComponentOptions) {
    const { em } = this;
    const path = this.collectionDataSource?.path!;
    const dataVariable = new DataVariable({ type: DataVariableType, path }, { em });

    new DynamicVariableListenerManager({
      em,
      dataVariable,
      updateValueFromDataVariable: () => {
        const collectionDef = {
          ...this.get(keyCollectionDefinition),
          componentDef: this.getComponentDef(),
        };

        const collectionItems = getCollectionItems(em, collectionDef, parentCollectionStateMap, opt);

        this.components().reset(collectionItems);
      },
    });
  }

  private deepToJSON(component: Component) {
    const componentJSON: Partial<ComponentDefinitionDefined> = JSON.parse(JSON.stringify(component));

    const hasNoChildren = component.components().length === 0;
    const isCollectionComponent = component.get(keyCollectionDefinition);
    if (hasNoChildren || isCollectionComponent) {
      delete componentJSON.components;
    }

    return componentJSON;
  }
}

function getCollectionItems(
  em: EditorModel,
  collectionDef: DataCollectionProps,
  parentCollectionStateMap: DataCollectionStateMap,
  opt: ComponentOptions,
) {
  const { componentDef, collectionConfig } = collectionDef;
  const result = validateCollectionConfig(collectionConfig, componentDef, em);
  if (!result) {
    return [];
  }

  const components: Component[] = [];
  const collectionId = collectionConfig.collectionId;
  const items = getDataSourceItems(collectionConfig.dataSource, em);
  const startIndex = Math.max(0, collectionConfig.startIndex || 0);
  const endIndex = Math.min(
    items.length - 1,
    collectionConfig.endIndex !== undefined ? collectionConfig.endIndex : Number.MAX_VALUE,
  );
  const totalItems = endIndex - startIndex + 1;
  let symbolMain: Component;

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

    if (parentCollectionStateMap[collectionId]) {
      em.logError(
        `The collection ID "${collectionId}" already exists in the parent collection state. Overriding it is not allowed.`,
      );
      return [];
    }

    const collectionsStateMap: DataCollectionStateMap = {
      ...parentCollectionStateMap,
      [collectionId]: collectionState,
    };

    if (index === startIndex) {
      const componentType = (componentDef?.type as string) || 'default';
      let type = em.Components.getType(componentType) || em.Components.getType('default');
      const Model = type.model;
      symbolMain = new Model({ ...deepClone(componentDef), draggable: false }, opt);
      setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(symbolMain);
    }

    const instance = symbolMain!.clone({ symbol: true });
    setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(instance);

    components.push(instance);
  }

  return components;
}

function setCollectionStateMapAndPropagate(
  collectionsStateMap: DataCollectionStateMap,
  collectionId: string | undefined,
) {
  return (cmp: Component) => {
    setCollectionStateMap(collectionsStateMap)(cmp);

    const addListener = (component: Component) => {
      setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(component);
    };

    const listenerKey = `_hasAddListener${collectionId ? `_${collectionId}` : ''}`;
    const cmps = cmp.components();

    // Add the 'add' listener if not already in the listeners array
    if (!cmp.collectionStateListeners.includes(listenerKey)) {
      cmp.listenTo(cmps, 'add', addListener);
      cmp.collectionStateListeners.push(listenerKey);

      const removeListener = (component: Component) => {
        component.stopListening(component.components(), 'add', addListener);
        component.off(`change:${keyCollectionsStateMap}`, handleCollectionStateMapChange);
        const index = component.collectionStateListeners.indexOf(listenerKey);
        if (index > -1) {
          component.collectionStateListeners.splice(index, 1);
        }
      };

      cmp.listenTo(cmps, 'remove', removeListener);
    }

    cmps?.toArray().forEach((component: Component) => {
      setCollectionStateMapAndPropagate(collectionsStateMap, collectionId)(component);
    });

    cmp.on(`change:${keyCollectionsStateMap}`, handleCollectionStateMapChange);
  };
}

function handleCollectionStateMapChange(this: Component) {
  const updatedCollectionsStateMap = this.get(keyCollectionsStateMap);
  this.components()
    ?.toArray()
    .forEach((component: Component) => {
      setCollectionStateMap(updatedCollectionsStateMap)(component);
    });
}

function logErrorIfMissing(property: any, propertyPath: string, em: EditorModel) {
  if (!property) {
    em.logError(`The "${propertyPath}" property is required in the collection definition.`);
    return false;
  }
  return true;
}

function validateCollectionConfig(
  collectionConfig: DataCollectionConfig,
  componentDef: ComponentDefinition,
  em: EditorModel,
) {
  const validations = [
    { property: collectionConfig, propertyPath: 'collectionConfig' },
    { property: componentDef, propertyPath: 'componentDef' },
    { property: collectionConfig?.collectionId, propertyPath: 'collectionConfig.collectionId' },
    { property: collectionConfig?.dataSource, propertyPath: 'collectionConfig.dataSource' },
  ];

  for (const { property, propertyPath } of validations) {
    if (!logErrorIfMissing(property, propertyPath, em)) {
      return [];
    }
  }

  return true;
}

function setCollectionStateMap(collectionsStateMap: DataCollectionStateMap) {
  return (cmp: Component) => {
    cmp.set(keyIsCollectionItem, true);
    const updatedCollectionStateMap = {
      ...cmp.get(keyCollectionsStateMap),
      ...collectionsStateMap,
    };
    cmp.set(keyCollectionsStateMap, updatedCollectionStateMap);
    cmp.componentDVListener.updateCollectionStateMap(updatedCollectionStateMap);
  };
}

function getDataSourceItems(dataSource: DataCollectionDataSource, em: EditorModel) {
  let items: DataVariableProps[] = [];

  switch (true) {
    case isArray(dataSource):
      items = dataSource;
      break;
    case isObject(dataSource) && dataSource instanceof DataSource: {
      const id = dataSource.get('id')!;
      items = listDataSourceVariables(id, em);
      break;
    }
    case isDataVariable(dataSource): {
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

function listDataSourceVariables(dataSource_id: string, em: EditorModel): DataVariableProps[] {
  const records = em.DataSources.getValue(dataSource_id, []);
  const keys = Object.keys(records);

  return keys.map((key) => ({
    type: DataVariableType,
    path: dataSource_id + '.' + key,
  }));
}

function deepClone(obj: ObjectAny) {
  if (obj === null || typeof obj !== 'object') return obj;

  const clone = Array.isArray(obj) ? [] : {};

  Object.keys(obj).forEach((key) => {
    (clone as any)[key] = deepClone((obj as any)[key]);
  });

  return clone;
}
