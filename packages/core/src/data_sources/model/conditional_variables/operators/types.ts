import { AnyTypeOperation } from './AnyTypeOperator';
import { BooleanOperation } from './BooleanOperator';
import { NumberOperation } from './NumberOperator';
import { StringOperation } from './StringOperator';

export type Operation = AnyTypeOperation | StringOperation | NumberOperation | BooleanOperation;
