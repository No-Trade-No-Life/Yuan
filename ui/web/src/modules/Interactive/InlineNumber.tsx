/**
 * 人类易读的数字格式
 */
export const InlineNumber = (props: { number: number | string }) => {
  if (typeof props.number === 'string') return <InlineNumber number={parseFloat(props.number)} />;
  if (typeof props.number !== 'number') return <span>---</span>;

  if (props.number === Infinity) {
    return <span>∞</span>;
  }

  if (Number.isNaN(props.number)) {
    return <span>N/A</span>;
  }

  if (props.number >= 1_000_000_000) {
    return <span>{(props.number / 1_000_000_000).toFixed(2)}B</span>;
  }

  if (props.number >= 1_000_000) {
    return <span>{(props.number / 1_000_000).toFixed(2)}M</span>;
  }

  if (props.number >= 1_000) {
    return <span>{(props.number / 1_000).toFixed(2)}K</span>;
  }

  if (props.number >= 1) {
    return <span>{props.number.toPrecision(4)}</span>;
  }

  if (props.number > 0) {
    const matcher = props.number.toFixed(18).match(/(\d+)\.(0{3,})(\d{1,4})/);
    if (matcher) {
      return (
        <span>
          {matcher[1]}.0<sub>{matcher[2].length}</sub>
          {matcher[3]}
        </span>
      );
    }
    return <span>{props.number.toPrecision(4)}</span>;
  }
  if (props.number === 0) {
    return <span>0</span>;
  }
  if (props.number < 0) {
    return (
      <>
        -
        <InlineNumber number={-props.number} />
      </>
    );
  }
  return <span>{props.number}</span>;
};
