import { ObjectAny } from '../../common';
import EditorModel from '../../editor/model/Editor';
import Component, { dynamicAttrKey } from './Component';
import { DynamicValueWatcher } from './DynamicValueWatcher';

export class ComponentDynamicValueListener {
  private propertyWatcher: DynamicValueWatcher;
  private attributeWatcher: DynamicValueWatcher;
  private traitsWatcher: DynamicValueWatcher;

  constructor(
    private component: Component,
    em: EditorModel,
  ) {
    this.propertyWatcher = new DynamicValueWatcher(this.createPropertyUpdater(), em);
    this.attributeWatcher = new DynamicValueWatcher(this.createAttributeUpdater(), em);
    this.traitsWatcher = new DynamicValueWatcher(this.createTraitUpdater(), em);
  }

  private createPropertyUpdater() {
    return (key: string, value: any) => {
      this.component.set(key, value, { skipWatcherUpdates: false, avoidStore: true });
    };
  }

  private createAttributeUpdater() {
    return (key: string, value: any) => {
      this.component.addAttributes({ [key]: value }, { skipWatcherUpdates: false });
    };
  }

  private createTraitUpdater() {
    return (key: string, value: any) => {
      this.component.updateTrait(key, { value });
      const trait = this.component.getTrait(key);
      trait.setTargetValue(value);
    };
  }

  static evaluateComponentDef(values: ObjectAny, em: EditorModel) {
    const props = DynamicValueWatcher.getStaticValues(values, em);

    if (values.attributes) {
      props.attributes = DynamicValueWatcher.getStaticValues(values.attributes, em);
    }

    if (Array.isArray(values[dynamicAttrKey]) && values[dynamicAttrKey].length > 0) {
      values.traits = values.traits ? [...values[dynamicAttrKey], ...values.traits] : values[dynamicAttrKey];
    }

    if (values.traits) {
      const evaluatedTraitsValues = DynamicValueWatcher.getStaticValues(
        values.traits.map((trait: any) => trait.value),
        em,
      );

      props.traits = values.traits.map((trait: any, index: number) => ({
        ...trait,
        value: evaluatedTraitsValues[index],
      }));
    }

    return props;
  }

  watchComponentDef(values: ObjectAny) {
    this.watchProps(values);
    this.watchAttributes(values.attributes);
    this.watchTraits(values.traits);
  }

  watchProps(props: ObjectAny) {
    this.propertyWatcher.removeListeners(Object.keys(props));
    this.propertyWatcher.watchDynamicValue(props);
  }

  getDynamicPropsDefs() {
    return this.propertyWatcher.getAllSerializableValues();
  }

  setAttributes(attributes: ObjectAny) {
    this.attributeWatcher.removeListeners();
    this.attributeWatcher.watchDynamicValue(attributes);
  }

  watchAttributes(attributes: ObjectAny) {
    this.attributeWatcher.watchDynamicValue(attributes);
  }

  watchTraits(traits: (string | ObjectAny)[]) {
    const evaluatedTraits: { [key: string]: ObjectAny } = {};

    traits?.forEach((trait: any) => {
      if (typeof trait === 'object' && trait.name) {
        evaluatedTraits[trait.name] = trait.value;
      }
    });

    this.traitsWatcher.watchDynamicValue(evaluatedTraits);
  }

  removeAttributes(attributes: string[]) {
    this.attributeWatcher.removeListeners(attributes);
  }

  getAttributesDefsOrValues(attributes: ObjectAny) {
    return this.attributeWatcher.getSerializableValues(attributes);
  }

  getTraitsDefs() {
    return this.traitsWatcher.getAllSerializableValues();
  }

  getPropsDefsOrValues(props: ObjectAny) {
    return this.propertyWatcher.getSerializableValues(props);
  }

  destroy() {
    this.propertyWatcher.removeListeners();
    this.attributeWatcher.removeListeners();
    this.traitsWatcher.removeListeners();
  }
}
