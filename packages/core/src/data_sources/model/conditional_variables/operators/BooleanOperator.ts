import { Operator } from './BaseOperator';

export enum BooleanOperation {
  and = 'and',
  or = 'or',
  xor = 'xor',
}

export class BooleanOperator extends Operator<BooleanOperation> {
  evaluate(statements: boolean[]): boolean {
    if (!statements.length) throw new Error('Expected one or more statments, got none');

    switch (this.operation) {
      case BooleanOperation.and:
        return statements.every(Boolean);
      case BooleanOperation.or:
        return statements.some(Boolean);
      case BooleanOperation.xor:
        return statements.filter(Boolean).length === 1;
      default:
        this.em.logError(`Unsupported logical operation: ${this.operation}`);
        return false;
    }
  }
}
