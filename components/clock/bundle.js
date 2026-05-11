var ClockWidget = (function() {
  var React = window.React;
  var jsx = window.jsxRuntime.jsx;

  function Clock(props) {
    var state = React.useState(new Date());
    var time = state[0];
    var setTime = state[1];

    React.useEffect(function() {
      var timer = setInterval(function() { setTime(new Date()); }, 1000);
      return function() { clearInterval(timer); };
    }, []);

    var config = props.config || {};
    var format = config.format || '24h';
    var timeStr = format === '12h'
      ? time.toLocaleTimeString('en-US', { hour12: true })
      : time.toLocaleTimeString('en-US', { hour12: false });

    return jsx('div', {
      className: 'flex flex-col items-center justify-center h-full gap-1',
      children: [
        jsx('span', { key: 'time', className: 'text-3xl font-mono font-bold text-foreground', children: timeStr }),
        jsx('span', { key: 'date', className: 'text-sm text-muted-foreground', children: time.toLocaleDateString() })
      ]
    });
  }

  return { default: Clock, Clock: Clock };
})();
