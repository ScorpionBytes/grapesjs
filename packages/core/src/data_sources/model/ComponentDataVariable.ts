import Component from '../../dom_components/model/Component';
import { ComponentOptions } from '../../dom_components/model/types';
import { toLowerCase } from '../../utils/mixins';
import DataVariable, { DataVariableProps, DataVariableType } from './DataVariable';

export default class ComponentDataVariable extends Component {
  dataResolver: DataVariable;

  get defaults() {
    return {
      // @ts-ignore
      ...super.defaults,
      type: DataVariableType,
      path: '',
      defaultValue: '',
    };
  }

  constructor(props: DataVariableProps, opt: ComponentOptions) {
    super(props, opt);
    const { type, path, defaultValue } = props;
    this.dataResolver = new DataVariable({ type, path, defaultValue }, opt);
  }

  getPath() {
    return this.dataResolver.get('path');
  }

  getDefaultValue() {
    return this.dataResolver.get('defaultValue');
  }

  getDataValue() {
    return this.dataResolver.getDataValue();
  }

  getInnerHTML() {
    return this.getDataValue();
  }

  setPath(newPath: string) {
    this.dataResolver.set('path', newPath);
  }

  setDefaultValue(newValue: string) {
    this.dataResolver.set('defaultValue', newValue);
  }

  static isComponent(el: HTMLElement) {
    return toLowerCase(el.tagName) === DataVariableType;
  }
}
