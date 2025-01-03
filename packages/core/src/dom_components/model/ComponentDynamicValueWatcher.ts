import { ObjectAny } from '../../common';
import { CollectionsStateMap } from '../../data_sources/model/collection_component/types';
import EditorModel from '../../editor/model/Editor';
import Component from './Component';
import { DynamicWatchersOptions } from './DynamicValueWatcher';
import { DynamicValueWatcher } from './DynamicValueWatcher';

export class ComponentDynamicValueWatcher {
  private propertyWatcher: DynamicValueWatcher;
  private attributeWatcher: DynamicValueWatcher;

  constructor(
    component: Component | undefined,
    options: {
      em: EditorModel;
      collectionsStateMap: CollectionsStateMap;
    },
  ) {
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
    this.propertyWatcher.bindComponent(component);
    this.attributeWatcher.bindComponent(component);
  }

  addProps(props: ObjectAny, options?: DynamicWatchersOptions) {
    return this.propertyWatcher.addDynamicValues(props, options);
  }

  addAttributes(attributes: ObjectAny, options?: DynamicWatchersOptions) {
    return this.attributeWatcher.addDynamicValues(attributes, options);
  }

  setAttributes(attributes: ObjectAny, options?: DynamicWatchersOptions) {
    return this.attributeWatcher.setDynamicValues(attributes, options);
  }

  removeAttributes(attributes: string[]) {
    this.attributeWatcher.removeListeners(attributes);
  }

  getDynamicPropsDefs() {
    return this.propertyWatcher.getAllSerializableValues();
  }

  getDynamicAttributesDefs() {
    return this.attributeWatcher.getAllSerializableValues();
  }

  getAttributesDefsOrValues(attributes: ObjectAny) {
    return this.attributeWatcher.getSerializableValues(attributes);
  }

  getPropsDefsOrValues(props: ObjectAny) {
    return this.propertyWatcher.getSerializableValues(props);
  }

  destroy() {
    this.propertyWatcher.removeListeners();
    this.attributeWatcher.removeListeners();
  }
}
