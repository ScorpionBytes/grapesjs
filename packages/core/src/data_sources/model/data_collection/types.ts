import { CollectionComponentType, CollectionVariableType, keyCollectionDefinition } from './constants';
import { ComponentDefinition } from '../../../dom_components/model/types';
import { DataVariableDefinition } from '../DataVariable';

export type DataCollectionDataSource = any[] | DataVariableDefinition | DataCollectionVariableDefinition;

export interface DataCollectionConfig {
  startIndex?: number;
  endIndex?: number;
  dataSource: DataCollectionDataSource;
}

export enum DataCollectionStateVariableType {
  currentIndex = 'currentIndex',
  startIndex = 'startIndex',
  currentItem = 'currentItem',
  endIndex = 'endIndex',
  collectionName = 'collectionName',
  totalItems = 'totalItems',
  remainingItems = 'remainingItems',
}

export interface DataCollectionState {
  [DataCollectionStateVariableType.currentIndex]: number;
  [DataCollectionStateVariableType.startIndex]: number;
  [DataCollectionStateVariableType.currentItem]: any;
  [DataCollectionStateVariableType.endIndex]: number;
  [DataCollectionStateVariableType.collectionName]?: string;
  [DataCollectionStateVariableType.totalItems]: number;
  [DataCollectionStateVariableType.remainingItems]: number;
}

export interface DataCollectionStateMap {
  [key: string]: DataCollectionState;
}

export interface ComponentDataCollectionDefinition extends ComponentDefinition {
  [keyCollectionDefinition]: DataCollectionDefinition;
}

export interface DataCollectionDefinition {
  type: typeof CollectionComponentType;
  collectionName?: string;
  config: DataCollectionConfig;
  block: ComponentDefinition;
}

export type DataCollectionVariableDefinition = {
  type: typeof CollectionVariableType;
  variableType: DataCollectionStateVariableType;
  collectionName?: string;
  path?: string;
};
