import { DynamicValueDefinition } from './../../data_sources/types';
import { DataCollectionStateMap } from '../../data_sources/model/data_collection/types';
import { Model, ObjectAny } from '../../common';
import DynamicVariableListenerManager from '../../data_sources/model/DataVariableListenerManager';
import { evaluateDynamicValueDefinition, isDynamicValueDefinition } from '../../data_sources/model/utils';
import EditorModel from '../../editor/model/Editor';
import Component from './Component';
import { CollectionVariableType } from '../../data_sources/model/data_collection/constants';
import { ModelDestroyOptions } from 'backbone';

export interface DynamicWatchersOptions {
  skipWatcherUpdates?: boolean;
  fromDataSource?: boolean;
}

type UpdateFn = (component: Component | undefined, key: string, value: any) => void;

export class DynamicValueWatcher extends Model<{ component: Component | undefined; updateFn: UpdateFn }> {
  private dynamicVariableListeners: { [key: string]: DynamicVariableListenerManager } = {};
  private em: EditorModel;
  private collectionsStateMap?: DataCollectionStateMap;
  constructor(
    private component: Component | undefined,
    private updateFn: UpdateFn,
    options: {
      em: EditorModel;
      collectionsStateMap?: DataCollectionStateMap;
    },
  ) {
    super({ component, updateFn }, options);
    this.em = options.em;
    this.collectionsStateMap = options.collectionsStateMap;
  }

  bindComponent(component: Component) {
    this.component = component;
  }

  updateCollectionStateMap(collectionsStateMap: DataCollectionStateMap) {
    this.collectionsStateMap = collectionsStateMap;

    const collectionVariablesKeys = this.getDynamicValuesOfType(CollectionVariableType);
    const collectionVariablesObject = collectionVariablesKeys.reduce(
      (acc: { [key: string]: DynamicValueDefinition | null }, key) => {
        acc[key] = null;
        return acc;
      },
      {},
    );
    const newVariables = this.getSerializableValues(collectionVariablesObject);
    const evaluatedValues = this.addDynamicValues(newVariables);

    Object.keys(evaluatedValues).forEach((key) => {
      this.updateFn(this.component, key, evaluatedValues[key]);
    });
  }

  setDynamicValues(values: ObjectAny | undefined, options: DynamicWatchersOptions = {}) {
    const shouldSkipWatcherUpdates = options.skipWatcherUpdates || options.fromDataSource;
    if (!shouldSkipWatcherUpdates) {
      this.removeListeners();
    }

    return this.addDynamicValues(values, options);
  }

  addDynamicValues(values: ObjectAny | undefined, options: DynamicWatchersOptions = {}) {
    if (!values) return {};
    const evaluatedValues = this.evaluateValues(values);

    const shouldSkipWatcherUpdates = options.skipWatcherUpdates || options.fromDataSource;
    if (!shouldSkipWatcherUpdates) {
      this.updateListeners(values);
    }

    return evaluatedValues;
  }

  private updateListeners(values: { [key: string]: any }) {
    const { em, collectionsStateMap } = this;
    this.removeListeners(Object.keys(values));
    const propsKeys = Object.keys(values);
    for (let index = 0; index < propsKeys.length; index++) {
      const key = propsKeys[index];
      if (!isDynamicValueDefinition(values[key])) {
        continue;
      }

      const { variable } = evaluateDynamicValueDefinition(values[key], {
        em,
        collectionsStateMap,
      });
      this.dynamicVariableListeners[key] = new DynamicVariableListenerManager({
        em,
        dataVariable: variable,
        updateValueFromDataVariable: (value: any) => {
          this.updateFn.bind(this)(this.component, key, value);
        },
      });
    }
  }

  private evaluateValues(values: ObjectAny) {
    const { em, collectionsStateMap } = this;
    const evaluatedValues: {
      [key: string]: any;
    } = { ...values };
    const propsKeys = Object.keys(values);
    for (let index = 0; index < propsKeys.length; index++) {
      const key = propsKeys[index];
      if (!isDynamicValueDefinition(values[key])) {
        continue;
      }
      const { value } = evaluateDynamicValueDefinition(values[key], {
        em,
        collectionsStateMap,
      });
      evaluatedValues[key] = value;
    }

    return evaluatedValues;
  }

  /**
   * removes listeners to stop watching for changes,
   * if keys argument is omitted, remove all listeners
   * @argument keys
   */
  removeListeners(keys?: string[]) {
    const propsKeys = keys ? keys : Object.keys(this.dynamicVariableListeners);
    propsKeys.forEach((key) => {
      if (this.dynamicVariableListeners[key]) {
        this.dynamicVariableListeners[key].destroy();
        delete this.dynamicVariableListeners[key];
      }
    });

    return propsKeys;
  }

  getSerializableValues(values: ObjectAny | undefined) {
    if (!values) return {};
    const serializableValues = { ...values };
    const propsKeys = Object.keys(serializableValues);
    for (let index = 0; index < propsKeys.length; index++) {
      const key = propsKeys[index];
      if (this.dynamicVariableListeners[key]) {
        serializableValues[key] = this.dynamicVariableListeners[key].dynamicVariable.toJSON();
      }
    }

    return serializableValues;
  }

  getAllSerializableValues() {
    const serializableValues: ObjectAny = {};
    const propsKeys = Object.keys(this.dynamicVariableListeners);
    for (let index = 0; index < propsKeys.length; index++) {
      const key = propsKeys[index];
      serializableValues[key] = this.dynamicVariableListeners[key].dynamicVariable.toJSON();
    }

    return serializableValues;
  }

  getDynamicValuesOfType(type: DynamicValueDefinition['type']) {
    const keys = Object.keys(this.dynamicVariableListeners).filter((key: string) => {
      // @ts-ignore
      return this.dynamicVariableListeners[key].dynamicVariable.get('type') === type;
    });

    return keys;
  }

  destroy(options?: ModelDestroyOptions | undefined): false | JQueryXHR {
    this.removeListeners();
    return super.destroy();
  }
}
