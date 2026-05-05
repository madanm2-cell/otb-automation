'use client';

import { forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { Checkbox, Divider } from 'antd';
import { useGridFilter } from 'ag-grid-react';

interface FilterModel {
  values: string[];
}

export const SelectFilter = forwardRef(function SelectFilter(props: any, _ref) {
  const { getValue, model, onModelChange, api } = props as {
    getValue: (node: any) => any;
    model: FilterModel | null;
    onModelChange: (model: FilterModel | null) => void;
    api: any;
  };

  const [values, setValues] = useState<string[]>([]);

  // Keep a ref to always have latest model in doesFilterPass without stale closure
  const modelRef = useRef<FilterModel | null>(model);
  useEffect(() => { modelRef.current = model; }, [model]);

  useGridFilter({
    doesFilterPass({ node }) {
      const m = modelRef.current;
      if (!m) return true;
      const val = String(getValue(node) ?? '');
      return m.values.includes(val);
    },
  });

  useEffect(() => {
    const vals = new Set<string>();
    api.forEachNode((node: any) => {
      const val = getValue(node);
      if (val != null && val !== '') vals.add(String(val));
    });
    setValues(Array.from(vals).sort());
  }, [api, getValue]);

  const isChecked = (val: string) => !model || model.values.includes(val);
  const allChecked = !model || model.values.length === values.length;
  const indeterminate = !!model && model.values.length > 0 && model.values.length < values.length;

  const toggle = useCallback((val: string) => {
    const current = new Set(model ? model.values : values);
    if (current.has(val)) current.delete(val); else current.add(val);
    onModelChange(current.size === values.length ? null : { values: Array.from(current) });
  }, [model, values, onModelChange]);

  const toggleAll = useCallback(() => {
    onModelChange(allChecked ? { values: [] } : null);
  }, [allChecked, onModelChange]);

  return (
    <div style={{ padding: '12px 16px', minWidth: 200, maxHeight: 360, display: 'flex', flexDirection: 'column' }}>
      <Checkbox
        indeterminate={indeterminate}
        checked={allChecked}
        onChange={toggleAll}
        style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
      >
        Select All
      </Checkbox>
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {values.map(val => (
          <div key={val} style={{ padding: '5px 0' }}>
            <Checkbox
              checked={isChecked(val)}
              onChange={() => toggle(val)}
              style={{ fontSize: 14 }}
            >
              {val}
            </Checkbox>
          </div>
        ))}
      </div>
    </div>
  );
});
