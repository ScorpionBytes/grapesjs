import { Operator } from './BaseOperator';

export enum StringOperation {
  contains = 'contains',
  startsWith = 'startsWith',
  endsWith = 'endsWith',
  matchesRegex = 'matchesRegex',
  equalsIgnoreCase = 'equalsIgnoreCase',
  trimEquals = 'trimEquals',
}

export class StringOperator extends Operator<StringOperation> {
  evaluate(left: string, right: string) {
    switch (this.operation) {
      case StringOperation.contains:
        return left.includes(right);
      case StringOperation.startsWith:
        return left.startsWith(right);
      case StringOperation.endsWith:
        return left.endsWith(right);
      case StringOperation.matchesRegex:
        if (!right) this.em.logError('Regex pattern must be provided.');
        return new RegExp(right).test(left);
      case StringOperation.equalsIgnoreCase:
        return left.toLowerCase() === right.toLowerCase();
      case StringOperation.trimEquals:
        return left.trim() === right.trim();
      default:
        this.em.logError(`Unsupported string operation: ${this.operation}`);
        return false;
    }
  }
}
