import { Component, DataRecord, DataSource, DataSourceManager, Editor } from '../../../../../src';
import { DataVariableType } from '../../../../../src/data_sources/model/DataVariable';
import {
  CollectionComponentType,
  CollectionVariableType,
} from '../../../../../src/data_sources/model/data_collection/constants';
import { DataCollectionStateVariableType } from '../../../../../src/data_sources/model/data_collection/types';
import EditorModel from '../../../../../src/editor/model/Editor';
import { setupTestEditor } from '../../../../common';

describe('Collection component', () => {
  let em: EditorModel;
  let editor: Editor;
  let dsm: DataSourceManager;
  let dataSource: DataSource;
  let wrapper: Component;
  let firstRecord: DataRecord;
  let secondRecord: DataRecord;

  beforeEach(() => {
    ({ em, editor, dsm } = setupTestEditor());
    wrapper = em.getWrapper()!;
    dataSource = dsm.add({
      id: 'my_data_source_id',
      records: [
        { id: 'user1', user: 'user1', age: '12' },
        { id: 'user2', user: 'user2', age: '14' },
        { id: 'user3', user: 'user3', age: '16' },
      ],
    });

    firstRecord = dataSource.getRecord('user1')!;
    secondRecord = dataSource.getRecord('user2')!;
  });

  afterEach(() => {
    em.destroy();
  });

  test('Collection variable components', async () => {
    const cmp = wrapper.components({
      type: CollectionComponentType,
      collectionDef: {
        componentDef: {
          type: 'default',
          components: [
            {
              type: CollectionVariableType,
              variableType: DataCollectionStateVariableType.currentItem,
              path: 'user',
            },
          ],
        },
        collectionConfig: {
          dataSource: {
            type: DataVariableType,
            path: 'my_data_source_id',
          },
        },
      },
    })[0];

    const firstGrandchild = cmp.components().at(0).components().at(0);
    expect(firstGrandchild.getInnerHTML()).toContain('user1');

    const secondGrandchild = cmp.components().at(1).components().at(0);
    expect(secondGrandchild.getInnerHTML()).toContain('user2');
  });
});
