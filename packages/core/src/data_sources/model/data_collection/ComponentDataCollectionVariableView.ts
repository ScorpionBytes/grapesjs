import ComponentView from '../../../dom_components/view/ComponentView';
import DynamicVariableListenerManager from '../DataVariableListenerManager';
import ComponentDataCollectionVariable from './ComponentDataCollectionVariable';

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
