import { Component } from 'react';

export default class InputNumber extends Component {

  render() {

    const {min, max, value, onChange} = this.props;

    return <input
        type="number"
        min={min}
        max={max}
        value={value}
        style={{ width: 100 }}
        onChange={e => {
            const newValue = Number.parseInt(e.target.value)
            if (newValue >= min && newValue <= max) {
                onChange(newValue);
            }
        }}
    />;
  }
}