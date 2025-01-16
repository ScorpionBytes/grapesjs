import Component, { keyCollectionsStateMap, keySymbolOvrd } from '../../../dom_components/model/Component';
import { ComponentOptions, ComponentProperties } from '../../../dom_components/model/types';
import { toLowerCase } from '../../../utils/mixins';
import DataCollectionVariable from './DataCollectionVariable';
import { CollectionVariableType, keyInnerCollectionState } from './constants';
import { DataCollectionStateMap, DataCollectionVariableDefinition } from './types';

export default class ComponentDataCollectionVariable extends Component {
  datacollectionVariable: DataCollectionVariable;

  get defaults() {
    return {
      // @ts-ignore
      ...super.defaults,
      type: CollectionVariableType,
      collectionId: undefined,
      variableType: undefined,
      path: undefined,
    };
  }

  constructor(props: DataCollectionVariableDefinition & ComponentProperties, opt: ComponentOptions) {
    super(props, opt);
    const em = opt.em;
    const { type, variableType, path, collectionId } = props;

    this.datacollectionVariable = new DataCollectionVariable(
      { type, variableType, path, collectionId },
      {
        em,
        collectionsStateMap: this.get(keyCollectionsStateMap),
      },
    );

    this.listenTo(this, `change:${keyCollectionsStateMap}`, this.handleCollectionsMapStateUpdate);
  }

  private handleCollectionsMapStateUpdate(m: any, v: DataCollectionStateMap, opts = {}) {
    this.datacollectionVariable.updateCollectionsStateMap(v);
  }

  getDataValue() {
    return this.datacollectionVariable.getDataValue();
  }

  getInnerHTML() {
    return this.getDataValue();
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === CollectionVariableType;
  }
}
