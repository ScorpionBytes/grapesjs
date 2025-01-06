import { CollectionComponentType, keyCollectionDefinition } from './constants';

import { ComponentDefinition, ComponentProperties } from '../../../dom_components/model/types';
import { CollectionVariableDefinition } from '../../../../test/specs/dom_components/model/ComponentTypes';
import { DataVariableDefinition } from '../DataVariable';

type CollectionDataSource = any[] | DataVariableDefinition | CollectionVariableDefinition;
type CollectionConfig = {
  start_index?: number;
  end_index?: number;
  dataSource: CollectionDataSource;
};

export enum CollectionStateVariableType {
  current_index = 'current_index',
  start_index = 'start_index',
  current_item = 'current_item',
  end_index = 'end_index',
  collection_name = 'collection_name',
  total_items = 'total_items',
  remaining_items = 'remaining_items',
}

export type CollectionState = {
  [CollectionStateVariableType.current_index]: number;
  [CollectionStateVariableType.start_index]: number;
  [CollectionStateVariableType.current_item]: any;
  [CollectionStateVariableType.end_index]: number;
  [CollectionStateVariableType.collection_name]?: string;
  [CollectionStateVariableType.total_items]: number;
  [CollectionStateVariableType.remaining_items]: number;
};

export type CollectionsStateMap = {
  [key: string]: CollectionState;
};

export type CollectionComponentDefinition = {
  [keyCollectionDefinition]: CollectionDefinition;
} & ComponentDefinition;

export type CollectionDefinition = {
  type: typeof CollectionComponentType;
  collection_name?: string;
  config: CollectionConfig;
  block: ComponentDefinition;
};
