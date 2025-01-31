import ComponentView from '../../dom_components/view/ComponentView';
import DynamicVariableListenerManager from '../model/DataVariableListenerManager';
import ComponentDataCollectionVariable from '../model/data_collection/ComponentDataCollectionVariable';

export default class ComponentDataCollectionVariableView extends ComponentView<ComponentDataCollectionVariable> {
  collectionVariableListener?: DynamicVariableListenerManager;

  initialize(opt = {}) {
    super.initialize(opt);

    this.collectionVariableListener = new DynamicVariableListenerManager({
      em: this.em!,
      dataVariable: this.model.datacollectionVariable,
      updateValueFromDataVariable: this.postRender.bind(this),
    });
  }

  postRender() {
    const { model, el } = this;
    if (el) {
      el.innerHTML = model.datacollectionVariable.getDataValue();
    }

    super.postRender();
  }
}
