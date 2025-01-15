import { Model, ObjectAny } from '../../common';
import { CollectionVariableType, keyIsCollectionItem } from '../../data_sources/model/data_collection/constants';
import { DataCollectionStateMap } from '../../data_sources/model/data_collection/types';
import EditorModel from '../../editor/model/Editor';
import Component, { keyCollectionsStateMap } from './Component';
import { DynamicWatchersOptions } from './DynamicValueWatcher';
import { DynamicValueWatcher } from './DynamicValueWatcher';
import { getSymbolsToUpdate } from './SymbolUtils';

export class ComponentDynamicValueWatcher extends Model<Component> {
  private propertyWatcher: DynamicValueWatcher;
  private attributeWatcher: DynamicValueWatcher;

  constructor(
    private component: Component | undefined,
    options: {
      em: EditorModel;
      collectionsStateMap?: DataCollectionStateMap;
    },
  ) {
    super(component, options);
    this.propertyWatcher = new DynamicValueWatcher(component, this.createPropertyUpdater(), options);
    this.attributeWatcher = new DynamicValueWatcher(component, this.createAttributeUpdater(), options);
  }

  private createPropertyUpdater() {
    return (component: Component | undefined, key: string, value: any) => {
      if (!component) return;
      component.set(key, value, { fromDataSource: true, avoidStore: true });
    };
  }

  private createAttributeUpdater() {
    return (component: Component | undefined, key: string, value: any) => {
      if (!component) return;
      component.addAttributes({ [key]: value }, { fromDataSource: true, avoidStore: true });
    };
  }

  bindComponent(component: Component) {
    this.component = component;
    this.propertyWatcher.bindComponent(component);
    this.attributeWatcher.bindComponent(component);
    this.updateSymbolOverride();
  }

  updateCollectionStateMap(collectionsStateMap: DataCollectionStateMap) {
    this.propertyWatcher.updateCollectionStateMap(collectionsStateMap);
    this.attributeWatcher.updateCollectionStateMap(collectionsStateMap);
  }

  addProps(props: ObjectAny, options: DynamicWatchersOptions = {}) {
    const evaluatedProps = this.propertyWatcher.addDynamicValues(props, options);
    if (props.attributes) {
      const evaluatedAttributes = this.attributeWatcher.setDynamicValues(props.attributes, options);
      evaluatedProps['attributes'] = evaluatedAttributes;
    }

    const skipOverridUpdates = options.skipWatcherUpdates || options.fromDataSource;
    if (!skipOverridUpdates) {
      this.updateSymbolOverride();
    }

    return evaluatedProps;
  }

  removeAttributes(attributes: string[]) {
    this.attributeWatcher.removeListeners(attributes);
    this.updateSymbolOverride();
  }

  private updateSymbolOverride() {
    if (!this.component || !this.component.get(keyIsCollectionItem)) return;

    const keys = this.propertyWatcher.getDynamicValuesOfType(CollectionVariableType);
    const attributesKeys = this.attributeWatcher.getDynamicValuesOfType(CollectionVariableType);

    const combinedKeys = [keyCollectionsStateMap, ...keys];
    const haveOverridenAttributes = Object.keys(attributesKeys).length;
    if (haveOverridenAttributes) combinedKeys.push('attributes');

    const toUp = getSymbolsToUpdate(this.component);
    toUp.forEach((child) => {
      child.setSymbolOverride(combinedKeys, { fromDataSource: true });
    });
    this.component.setSymbolOverride(combinedKeys, { fromDataSource: true });
  }

  getDynamicPropsDefs() {
    return this.propertyWatcher.getAllSerializableValues();
  }

  getDynamicAttributesDefs() {
    return this.attributeWatcher.getAllSerializableValues();
  }

  getPropsDefsOrValues(props: ObjectAny) {
    return this.propertyWatcher.getSerializableValues(props);
  }

  getAttributesDefsOrValues(attributes: ObjectAny) {
    return this.attributeWatcher.getSerializableValues(attributes);
  }

  destroy() {
    return this.propertyWatcher.destroy() && this.attributeWatcher.destroy();
  }
}
