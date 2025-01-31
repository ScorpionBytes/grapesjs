import EditorModel from '../../editor/model/Editor';
import { DynamicValue, DynamicValueProps } from '../types';
import { DataCollectionStateMap } from './data_collection/types';
import DataCollectionVariable from './data_collection/DataCollectionVariable';
import { DataCollectionVariableType } from './data_collection/constants';
import { DataConditionType, DataCondition } from './conditional_variables/DataCondition';
import DataVariable, { DataVariableProps, DataVariableType } from './DataVariable';

export function isDynamicValueDefinition(value: any): value is DynamicValueProps {
  return (
    typeof value === 'object' && [DataVariableType, DataConditionType, DataCollectionVariableType].includes(value?.type)
  );
}

export function isDynamicValue(value: any): value is DynamicValue {
  return value instanceof DataVariable || value instanceof DataCondition;
}

export function isDataVariable(variable: any): variable is DataVariableProps {
  return variable?.type === DataVariableType;
}

export function isDataCondition(variable: any) {
  return variable?.type === DataConditionType;
}

export function evaluateVariable(variable: any, em: EditorModel) {
  return isDataVariable(variable) ? new DataVariable(variable, { em }).getDataValue() : variable;
}

export function getDynamicValueInstance(
  valueDefinition: DynamicValueProps,
  options: {
    em: EditorModel;
    collectionsStateMap?: DataCollectionStateMap;
  },
): DynamicValue {
  const { em } = options;
  const dynamicType = valueDefinition.type;
  let dynamicVariable: DynamicValue;

  switch (dynamicType) {
    case DataVariableType:
      dynamicVariable = new DataVariable(valueDefinition, { em: em });
      break;
    case DataConditionType: {
      const { condition, ifTrue, ifFalse } = valueDefinition;
      dynamicVariable = new DataCondition(condition, ifTrue, ifFalse, { em: em });
      break;
    }
    case DataCollectionVariableType: {
      dynamicVariable = new DataCollectionVariable(valueDefinition, options);
      break;
    }
    default:
      throw new Error(`Unsupported dynamic type: ${dynamicType}`);
  }

  return dynamicVariable;
}

export function evaluateDynamicValueDefinition(
  valueDefinition: DynamicValueProps,
  options: {
    em: EditorModel;
    collectionsStateMap?: DataCollectionStateMap;
  },
) {
  const dynamicVariable = getDynamicValueInstance(valueDefinition, options);

  return { variable: dynamicVariable, value: dynamicVariable.getDataValue() };
}
